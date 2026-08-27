/**
 * MM PO Release (Multiple Level) — live SAP fetch.
 * Config: PO_Release_Multiple_Fetch_API
 * Payload: { RELGROUP, RELCODE, PLANTS }
 * Returns: { data: rows[], fetched_at, error }
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { extractFalseStatusMessage, extractSapMessage } from "@/lib/mm/sap-message";

const CONFIG_NAME = "PO_Release_Multiple_Fetch_API";

export const fetchPoReleaseMultiple = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      relgroup: z.string().trim().min(1, "Release Group is required").max(10),
      relcode: z.string().trim().min(1, "Release Code is required").max(10),
      plants: z.array(z.string().trim().min(1)).min(1, "At least one plant is required"),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cfg } = await supabaseAdmin
      .from("sap_api_configs")
      .select("*")
      .eq("name", CONFIG_NAME)
      .maybeSingle();
    if (!cfg) throw new Error(`SAP API config "${CONFIG_NAME}" not found. Configure it in Admin → SAP API.`);
    if (!cfg.is_active) throw new Error(`SAP API config "${CONFIG_NAME}" is disabled.`);

    const [{ data: creds }, { data: globalSettings }, { data: globalSecret }] = await Promise.all([
      supabaseAdmin.from("sap_api_credentials").select("*").eq("config_id", cfg.id).maybeSingle(),
      supabaseAdmin.from("sap_global_settings").select("connection_mode, middleware_url").eq("id", "default").maybeSingle(),
      supabaseAdmin.from("sap_global_secrets").select("proxy_secret").eq("id", "default").maybeSingle(),
    ]);

    const inputs: Record<string, any> = {
      RELGROUP: data.relgroup.trim(),
      RELCODE: data.relcode.trim(),
      PLANTS: data.plants.map((p) => ({ PLANT: p.trim() })),
    };

    const globalProxy =
      globalSettings?.connection_mode === "via_proxy" &&
      !!(globalSettings?.middleware_url);
    const useProxy = cfg.auth_type === "proxy" || globalProxy;
    const middlewareUrl = globalSettings?.middleware_url?.trim() || null;

    let target: string;
    let method: string = cfg.http_method ?? "GET";
    let bodyOut: string | undefined;
    const headers: Record<string, string> = { Accept: "application/json" };
    let proxied = false;

    if (useProxy) {
      if (!middlewareUrl) throw new Error("Proxy mode is on but no middleware URL is configured.");
      target = `${middlewareUrl.replace(/\/$/, "")}/sap/invoke`;
      method = "POST";
      headers["Content-Type"] = "application/json";
      const secret =
        (cfg.proxy_secret_ref ? process.env[cfg.proxy_secret_ref] : undefined) ||
        globalSecret?.proxy_secret ||
        process.env.MIDDLEWARE_SHARED_SECRET;
      if (secret) headers["x-shared-secret"] = secret;
      bodyOut = JSON.stringify({ configId: cfg.id, inputs });
      proxied = true;
    } else {
      const qs = new URLSearchParams({
        RELGROUP: data.relgroup.trim(),
        RELCODE: data.relcode.trim(),
        PLANTS: data.plants.join(","),
      }).toString();
      const join = cfg.endpoint_url.includes("?") ? "&" : "?";
      target = `${cfg.endpoint_url}${join}${qs}`;
      if (cfg.auth_type === "basic" && creds?.username && creds?.password_encrypted) {
        headers.Authorization =
          "Basic " + Buffer.from(`${creds.username}:${creds.password_encrypted}`).toString("base64");
      }
    }

    for (const [k, v] of Object.entries((creds?.extra_headers ?? {}) as Record<string, string>)) {
      headers[k] = v;
    }

    const t0 = Date.now();
    let res: Response;
    try {
      res = await fetch(target, { method, headers, body: bodyOut });
    } catch (e) {
      const errMsg = (e as Error).message || "fetch failed";
      const latency_ms = Date.now() - t0;
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms,
        message: `po-release-multi network: ${errMsg}`,
      });
      return {
        data: [] as Record<string, any>[],
        fetched_at: new Date().toISOString(),
        error: `Could not reach SAP. ${errMsg}.`,
      };
    }

    const text = await res.text().catch(() => "");
    const message = `${res.status} ${res.statusText}`;
    const latency_ms = Date.now() - t0;

    if (!res.ok) {
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms,
        message: `po-release-multi: ${message} ${text.slice(0, 500)}`,
      });
      return {
        data: [] as Record<string, any>[],
        fetched_at: new Date().toISOString(),
        error: `SAP returned ${message}: ${text.slice(0, 200)}`,
      };
    }

    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      return {
        data: [] as Record<string, any>[],
        fetched_at: new Date().toISOString(),
        error: `Invalid JSON from SAP: ${text.slice(0, 200)}`,
      };
    }
    const sapJson: any = proxied ? (json?.data ?? json ?? {}) : json;

    const dataArr: any[] = Array.isArray(sapJson)
      ? sapJson
      : Array.isArray(sapJson?.DATA)
        ? sapJson.DATA
        : Array.isArray(sapJson?.data)
          ? sapJson.data
          : [];

    const rows: Record<string, any>[] = dataArr.map((r) =>
      r && typeof r === "object" ? { ...r } : {},
    );

    await supabaseAdmin.from("sap_api_sync_log").insert({
      config_id: cfg.id,
      status: "ok",
      latency_ms,
      rows_processed: rows.length,
      message: `po-release-multi: ${message}`,
    });

    return {
      data: rows,
      fetched_at: new Date().toISOString(),
      error: null as string | null,
    };
  });

const RELEASE_CONFIG_NAME = "PO_Release_API";
const REJECT_CONFIG_NAME = "PO_REJECT_API";

export type PoReleaseResult = {
  ebeln: string;
  ebelp: string;
  ok: boolean;
  msgtxt: string;
  error?: string;
  response?: any;
  MSGTXT?: string;
  STATUS?: string;
  RELSTATUS?: string;
  INDICATOR?: string;
};

async function processPoAction(
  configName: string,
  payloadKey: "RELEASE" | "REJECT",
  data: {
    relgroup: string;
    relcode: string;
    items: { EBELN: string; EBELP: string; REMARKS?: string }[];
  },
  logTag: string,
): Promise<{ results: PoReleaseResult[]; error: string | null }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: cfg } = await supabaseAdmin
    .from("sap_api_configs")
    .select("*")
    .eq("name", configName)
    .maybeSingle();
  if (!cfg) throw new Error(`SAP API config "${configName}" not found. Configure it in Admin → SAP API.`);
  if (!cfg.is_active) throw new Error(`SAP API config "${configName}" is disabled.`);

  const [{ data: creds }, { data: globalSettings }, { data: globalSecret }] = await Promise.all([
    supabaseAdmin.from("sap_api_credentials").select("*").eq("config_id", cfg.id).maybeSingle(),
    supabaseAdmin.from("sap_global_settings").select("connection_mode, middleware_url").eq("id", "default").maybeSingle(),
    supabaseAdmin.from("sap_global_secrets").select("proxy_secret").eq("id", "default").maybeSingle(),
  ]);

  const globalProxy =
    globalSettings?.connection_mode === "via_proxy" && !!(globalSettings?.middleware_url);
  const useProxy = cfg.auth_type === "proxy" || globalProxy;
  const middlewareUrl = globalSettings?.middleware_url?.trim() || null;

  const baseHeaders: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
  if (useProxy) {
    const secret =
      (cfg.proxy_secret_ref ? process.env[cfg.proxy_secret_ref] : undefined) ||
      globalSecret?.proxy_secret ||
      process.env.MIDDLEWARE_SHARED_SECRET;
    if (secret) baseHeaders["x-shared-secret"] = secret;
  } else if (cfg.auth_type === "basic" && creds?.username && creds?.password_encrypted) {
    baseHeaders.Authorization =
      "Basic " + Buffer.from(`${creds.username}:${creds.password_encrypted}`).toString("base64");
  }
  for (const [k, v] of Object.entries((creds?.extra_headers ?? {}) as Record<string, string>)) {
    baseHeaders[k] = v;
  }

  const results: PoReleaseResult[] = [];

  // Both RELEASE and REJECT are header-level (one call per EBELN). Dedupe by
  // EBELN and remember every selected EBELP so the UI can clear all matching
  // rows against a single header result.
  const isRelease = payloadKey === "RELEASE";
  const groups = new Map<string, { ebelps: string[]; remarks: string }>();
  for (const it of data.items) {
    const g = groups.get(it.EBELN);
    if (g) {
      g.ebelps.push(it.EBELP);
      if (!g.remarks && it.REMARKS) g.remarks = it.REMARKS;
    } else {
      groups.set(it.EBELN, { ebelps: [it.EBELP], remarks: it.REMARKS ?? "" });
    }
  }

  for (const [ebeln, grp] of groups) {
    const ebelp = "";

    const inputs = isRelease
      ? {
          RELEASE: {
            EBELN: ebeln,
            FRGCO: data.relcode.trim(),
            REMARKS: grp.remarks,
          },
        }
      : {
          REJECT: {
            EBELN: ebeln,
            REMARKS: grp.remarks,
          },
        };

    let target: string;
    let method: string = cfg.http_method ?? "POST";
    let bodyOut: string;
    let proxied = false;

    if (useProxy) {
      if (!middlewareUrl) throw new Error("Proxy mode is on but no middleware URL is configured.");
      target = `${middlewareUrl.replace(/\/$/, "")}/sap/invoke`;
      method = "POST";
      bodyOut = JSON.stringify({ configId: cfg.id, inputs });
      proxied = true;
    } else {
      target = cfg.endpoint_url;
      bodyOut = JSON.stringify(inputs);
    }

    const t0 = Date.now();
    let msgtxt = "";
    let ok = false;
    let errMsg: string | undefined;
    let sapResponse: any = undefined;
    let primaryOut: any = undefined;

    try {
      const res = await fetch(target, { method, headers: baseHeaders, body: bodyOut });
      const text = await res.text().catch(() => "");
      const latency_ms = Date.now() - t0;

      if (!res.ok) {
        errMsg = `SAP ${res.status} ${res.statusText}: ${text.slice(0, 200)}`;
      } else {
        let json: any = {};
        try {
          json = text ? JSON.parse(text) : {};
        } catch {
          errMsg = `Invalid JSON from SAP: ${text.slice(0, 200)}`;
        }
        if (!errMsg) {
          if (proxied && json?.ok !== true) {
            // Prefer the exact SAP text (MSGTXT/MESSAGE) over the middleware wrapper text.
            sapResponse = json?.data ?? json;
            const exact = extractSapMessage(json?.data) ?? extractSapMessage(json);
            msgtxt = exact ?? msgtxt;
            errMsg =
              exact ??
              String(json?.error ?? `Middleware reported SAP status ${json?.status ?? "unknown"}.`);
          } else {
            const sapJson: any = proxied ? json?.data : json;
            sapResponse = sapJson;
            const primary: any = Array.isArray(sapJson)
              ? sapJson[0]
              : Array.isArray(sapJson?.DATA)
                ? sapJson.DATA[0]
                : Array.isArray(sapJson?.data)
                  ? sapJson.data[0]
                  : sapJson;
            primaryOut = primary;

            const findFirst = (obj: any, keys: string[]): any => {
              if (!obj || typeof obj !== "object") return undefined;
              const wanted = new Set(keys.map((key) => key.toUpperCase()));
              for (const [key, value] of Object.entries(obj)) {
                if (wanted.has(key.toUpperCase())) return value;
              }
              for (const value of Object.values(obj)) {
                const found = findFirst(value, keys);
                if (found !== undefined) return found;
              }
              return undefined;
            };
            msgtxt = String(findFirst(primary, ["MSGTXT", "MESSAGE"]) ?? "");
            const status = String(
              findFirst(primary, ["STATUS", "MSGTY", "TYPE"]) ?? "",
            ).trim().toUpperCase();
            const successStatuses = new Set([
              "S", "I", "SUCCESS", "OK", "RELEASED",
              "TRUE", "T", "Y", "YES",
            ]);
            const failureStatuses = new Set(["FALSE", "F", "N", "NO", "E"]);
            const hasPayload =
              sapJson !== null &&
              typeof sapJson === "object" &&
              (Array.isArray(sapJson) ? sapJson.length > 0 : Object.keys(sapJson).length > 0);

            if (!hasPayload) {
              errMsg = `SAP returned an empty response; ${logTag} success could not be confirmed.`;
            } else if (!status) {
              errMsg = msgtxt || `SAP response did not include a ${logTag} status.`;
            } else if (successStatuses.has(status)) {
              ok = true;
            } else if (failureStatuses.has(status)) {
              errMsg = msgtxt || `SAP returned ${logTag} status ${status}.`;
            } else {
              errMsg = msgtxt || `SAP returned ${logTag} status ${status}.`;
            }
          }
        }
      }

      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: ok && !errMsg ? "ok" : "error",
        latency_ms,
        rows_processed: 1,
        message: `po-${logTag} ${ebeln}${ebelp ? `/${ebelp}` : ""}: ${errMsg ?? msgtxt ?? "done"}`.slice(0, 500),
      });
    } catch (e) {
      errMsg = (e as Error).message || "fetch failed";
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms: Date.now() - t0,
        message: `po-${logTag} network ${ebeln}: ${errMsg}`.slice(0, 500),
      });
    }

    const pick = (k: string): string | undefined => {
      const src = primaryOut;
      if (!src || typeof src !== "object") return undefined;
      for (const [key, value] of Object.entries(src)) {
        if (key.toUpperCase() === k) return value == null ? undefined : String(value);
      }
      return undefined;
    };
    const common = {
      ok: ok && !errMsg,
      msgtxt,
      error: errMsg,
      response: sapResponse,
      MSGTXT: pick("MSGTXT"),
      STATUS: pick("STATUS"),
      RELSTATUS: pick("RELSTATUS"),
      INDICATOR: pick("INDICATOR"),
    };

    // Report the same header-level result for every selected line under this PO.
    for (const ep of grp.ebelps) {
      results.push({ ebeln, ebelp: ep, ...common });
    }
  }

  return { results, error: null };
}

const poActionInput = z.object({
  relgroup: z.string().trim().min(1).max(10),
  relcode: z.string().trim().min(1).max(10),
  items: z.array(z.object({
    EBELN: z.string().trim().min(1),
    EBELP: z.string().trim().default(""),
    REMARKS: z.string().optional().default(""),
  })).min(1),
});

export const releasePoItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => poActionInput.parse(d))
  .handler(async ({ data }) => processPoAction(RELEASE_CONFIG_NAME, "RELEASE", data, "release"));

export const rejectPoItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => poActionInput.parse(d))
  .handler(async ({ data }) => processPoAction(REJECT_CONFIG_NAME, "REJECT", data, "reject"));

const PO_GET_CONFIG_NAME = "PO_GET_API";

export const fetchPoGet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      relgroup: z.string().trim().min(1, "Release Group is required").max(10),
      relcode: z.string().trim().min(1, "Release Code is required").max(10),
      plants: z.array(z.string().trim().min(1)).min(1, "At least one plant is required"),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cfg } = await supabaseAdmin
      .from("sap_api_configs")
      .select("*")
      .eq("name", PO_GET_CONFIG_NAME)
      .maybeSingle();
    if (!cfg) throw new Error(`SAP API config "${PO_GET_CONFIG_NAME}" not found. Configure it in Admin → SAP API.`);
    if (!cfg.is_active) throw new Error(`SAP API config "${PO_GET_CONFIG_NAME}" is disabled.`);

    const [{ data: creds }, { data: globalSettings }, { data: globalSecret }] = await Promise.all([
      supabaseAdmin.from("sap_api_credentials").select("*").eq("config_id", cfg.id).maybeSingle(),
      supabaseAdmin.from("sap_global_settings").select("connection_mode, middleware_url").eq("id", "default").maybeSingle(),
      supabaseAdmin.from("sap_global_secrets").select("proxy_secret").eq("id", "default").maybeSingle(),
    ]);

    const globalProxy =
      globalSettings?.connection_mode === "via_proxy" && !!(globalSettings?.middleware_url);
    const useProxy = cfg.auth_type === "proxy" || globalProxy;
    const middlewareUrl = globalSettings?.middleware_url?.trim() || null;

    const baseHeaders: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
    if (useProxy) {
      const secret =
        (cfg.proxy_secret_ref ? process.env[cfg.proxy_secret_ref] : undefined) ||
        globalSecret?.proxy_secret ||
        process.env.MIDDLEWARE_SHARED_SECRET;
      if (secret) baseHeaders["x-shared-secret"] = secret;
    } else if (cfg.auth_type === "basic" && creds?.username && creds?.password_encrypted) {
      baseHeaders.Authorization =
        "Basic " + Buffer.from(`${creds.username}:${creds.password_encrypted}`).toString("base64");
    }
    for (const [k, v] of Object.entries((creds?.extra_headers ?? {}) as Record<string, string>)) {
      baseHeaders[k] = v;
    }

    const allRows: Record<string, any>[] = [];
    let firstError: string | null = null;

    for (const plant of data.plants) {
      const inputs = {
        GET: {
          WERKS: plant.trim(),
          FRGGR: data.relgroup.trim(),
          FRGCO: data.relcode.trim(),
        },
      };

      let target: string;
      let method: string = cfg.http_method ?? "POST";
      let bodyOut: string;
      let proxied = false;

      if (useProxy) {
        if (!middlewareUrl) throw new Error("Proxy mode is on but no middleware URL is configured.");
        target = `${middlewareUrl.replace(/\/$/, "")}/sap/invoke`;
        method = "POST";
        bodyOut = JSON.stringify({ configId: cfg.id, inputs, raw: true });
        proxied = true;
      } else {
        target = cfg.endpoint_url;
        bodyOut = JSON.stringify(inputs);
      }

      const t0 = Date.now();
      try {
        const res = await fetch(target, { method, headers: baseHeaders, body: bodyOut });
        const text = await res.text().catch(() => "");
        const latency_ms = Date.now() - t0;

        if (!res.ok) {
          const msg = `SAP ${res.status} ${res.statusText}: ${text.slice(0, 200)}`;
          if (!firstError) firstError = msg;
          await supabaseAdmin.from("sap_api_sync_log").insert({
            config_id: cfg.id,
            status: "error",
            latency_ms,
            message: `po-get ${plant}: ${msg}`.slice(0, 500),
          });
          continue;
        }

        let json: any = {};
        try {
          json = text ? JSON.parse(text) : {};
        } catch {
          const msg = `Invalid JSON from SAP: ${text.slice(0, 200)}`;
          if (!firstError) firstError = msg;
          continue;
        }
        const sapJson: any = proxied ? (json?.data ?? json ?? {}) : json;

        // SAP/middleware may wrap STATUS and MSGTXT in data, GET, or an array.
        const falseStatusMessage = extractFalseStatusMessage(sapJson);
        if (falseStatusMessage) {
          if (!firstError) firstError = falseStatusMessage;
          await supabaseAdmin.from("sap_api_sync_log").insert({
            config_id: cfg.id,
            status: "error",
            latency_ms,
            message: `po-get ${plant}: STATUS FALSE ${falseStatusMessage}`.slice(0, 500),
          });
          continue;
        }

        const arr: any[] = Array.isArray(sapJson)
          ? sapJson
          : Array.isArray(sapJson?.DATA)
            ? sapJson.DATA
            : Array.isArray(sapJson?.data)
              ? sapJson.data
              : [];
        for (const r of arr) {
          if (r && typeof r === "object") allRows.push({ ...r });
        }

        await supabaseAdmin.from("sap_api_sync_log").insert({
          config_id: cfg.id,
          status: "ok",
          latency_ms,
          rows_processed: arr.length,
          message: `po-get ${plant}: ${res.status} ${res.statusText}`.slice(0, 500),
        });
      } catch (e) {
        const errMsg = (e as Error).message || "fetch failed";
        if (!firstError) firstError = `Could not reach SAP. ${errMsg}.`;
        await supabaseAdmin.from("sap_api_sync_log").insert({
          config_id: cfg.id,
          status: "error",
          latency_ms: Date.now() - t0,
          message: `po-get network ${plant}: ${errMsg}`.slice(0, 500),
        });
      }
    }

    return {
      data: allRows,
      fetched_at: new Date().toISOString(),
      error: allRows.length === 0 ? firstError : null,
    };
  });
