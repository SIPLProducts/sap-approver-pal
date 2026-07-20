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

export type PrReleaseResult = {
  preq_no: string;
  preq_item: string;
  ok: boolean;
  msgtxt: string;
  error?: string;
};

export const releasePrItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      relgroup: z.string().trim().min(1).max(10),
      relcode: z.string().trim().min(1).max(10),
      items: z.array(z.object({
        PREQ_NO: z.string().trim().min(1),
        PREQ_ITEM: z.string().trim().min(1),
        REMARKS: z.string().optional().default(""),
      })).min(1),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cfg } = await supabaseAdmin
      .from("sap_api_configs")
      .select("*")
      .eq("name", RELEASE_CONFIG_NAME)
      .maybeSingle();
    if (!cfg) throw new Error(`SAP API config "${RELEASE_CONFIG_NAME}" not found. Configure it in Admin → SAP API.`);
    if (!cfg.is_active) throw new Error(`SAP API config "${RELEASE_CONFIG_NAME}" is disabled.`);

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
        RELEASE: {
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
            const sapJson: any = proxied ? (json?.data ?? json ?? {}) : json;
            // Locate MSGTXT & MSGTY anywhere reasonable in the response.
            const findFirst = (obj: any, key: string): any => {
              if (!obj || typeof obj !== "object") return undefined;
              if (key in obj) return obj[key];
              for (const v of Object.values(obj)) {
                const found = findFirst(v, key);
                if (found !== undefined) return found;
              }
              return undefined;
            };
            msgtxt = String(findFirst(sapJson, "MSGTXT") ?? findFirst(sapJson, "MESSAGE") ?? "");
            const msgty = String(findFirst(sapJson, "MSGTY") ?? findFirst(sapJson, "TYPE") ?? "").toUpperCase();
            ok = msgty ? (msgty === "S" || msgty === "I") : true;
          }
        }

        await supabaseAdmin.from("sap_api_sync_log").insert({
          config_id: cfg.id,
          status: ok && !errMsg ? "ok" : "error",
          latency_ms,
          rows_processed: 1,
          message: `pr-release ${item.PREQ_NO}/${item.PREQ_ITEM}: ${errMsg ?? msgtxt ?? "done"}`.slice(0, 500),
        });
      } catch (e) {
        errMsg = (e as Error).message || "fetch failed";
        await supabaseAdmin.from("sap_api_sync_log").insert({
          config_id: cfg.id,
          status: "error",
          latency_ms: Date.now() - t0,
          message: `pr-release network ${item.PREQ_NO}/${item.PREQ_ITEM}: ${errMsg}`.slice(0, 500),
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

    return { results, error: null as string | null };
  });
