/**
 * MM PR Release (Multiple Level) — live SAP fetch.
 * Config: PR_Release_Multiple_Fetch_API
 * Payload: { RELGROUP, RELCODE }
 * Returns: { data: rows[], fetched_at, error }
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CONFIG_NAME = "PR_Release_Multiple_Fetch_API";

export const fetchPrReleaseMultiple = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      relgroup: z.string().trim().min(1, "Release Group is required").max(10),
      relcode: z.string().trim().min(1, "Release Code is required").max(10),
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

    const inputs: Record<string, string> = {
      RELGROUP: data.relgroup.trim(),
      RELCODE: data.relcode.trim(),
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
      const qs = new URLSearchParams(inputs).toString();
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
        message: `pr-release-multi network: ${errMsg}`,
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
        message: `pr-release-multi: ${message} ${text.slice(0, 500)}`,
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
      message: `pr-release-multi: ${message}`,
    });

    return {
      data: rows,
      fetched_at: new Date().toISOString(),
      error: null as string | null,
    };
  });

const RELEASE_CONFIG_NAME = "PR_Release_API";
const REJECT_CONFIG_NAME = "PR_Reject_API";

export type PrReleaseResult = {
  preq_no: string;
  preq_item: string;
  ok: boolean;
  msgtxt: string;
  error?: string;
};

async function processPrAction(
  configName: string,
  payloadKey: "RELEASE" | "REJECT",
  data: {
    relgroup: string;
    relcode: string;
    items: { PREQ_NO: string; PREQ_ITEM: string; REMARKS?: string }[];
  },
  logTag: string,
): Promise<{ results: PrReleaseResult[]; error: string | null }> {
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

  const results: PrReleaseResult[] = [];

  for (const item of data.items) {
    const inputs = {
      [payloadKey]: {
        BANFN: item.PREQ_NO,
        BNFPO: item.PREQ_ITEM,
        REL_CODE: data.relcode.trim(),
        REL_GRP: data.relgroup.trim(),
        REMARKS: item.REMARKS ?? "",
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
            errMsg = String(json?.error ?? `Middleware reported SAP status ${json?.status ?? "unknown"}.`);
          } else {
            const sapJson: any = proxied ? json?.data : json;
            const primary: any = Array.isArray(sapJson)
              ? sapJson[0]
              : Array.isArray(sapJson?.DATA)
                ? sapJson.DATA[0]
                : Array.isArray(sapJson?.data)
                  ? sapJson.data[0]
                  : sapJson;

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
        message: `pr-${logTag} ${item.PREQ_NO}/${item.PREQ_ITEM}: ${errMsg ?? msgtxt ?? "done"}`.slice(0, 500),
      });
    } catch (e) {
      errMsg = (e as Error).message || "fetch failed";
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms: Date.now() - t0,
        message: `pr-${logTag} network ${item.PREQ_NO}/${item.PREQ_ITEM}: ${errMsg}`.slice(0, 500),
      });
    }

    results.push({
      preq_no: item.PREQ_NO,
      preq_item: item.PREQ_ITEM,
      ok: ok && !errMsg,
      msgtxt,
      error: errMsg,
    });
  }

  return { results, error: null };
}

const prActionInput = z.object({
  relgroup: z.string().trim().min(1).max(10),
  relcode: z.string().trim().min(1).max(10),
  items: z.array(z.object({
    PREQ_NO: z.string().trim().min(1),
    PREQ_ITEM: z.string().trim().min(1),
    REMARKS: z.string().optional().default(""),
  })).min(1),
});

export const releasePrItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => prActionInput.parse(d))
  .handler(async ({ data }) => processPrAction(RELEASE_CONFIG_NAME, "RELEASE", data, "release"));

export const rejectPrItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => prActionInput.parse(d))
  .handler(async ({ data }) => processPrAction(REJECT_CONFIG_NAME, "REJECT", data, "reject"));

