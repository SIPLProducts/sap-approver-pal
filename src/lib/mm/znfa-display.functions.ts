/**
 * MM ZNFA Release — Display step. Fetches one NFA document from SAP.
 * Config: ZNFA_DISPLAY_GET_API
 * Payload: { TYPE_NFA, ZRFQS: [{ RFQ }], GET, REL_CODE, ZNFA_NUM, PRINT }
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CONFIG_NAME = "ZNFA_DISPLAY_GET_API";

export type ZnfaDisplayRow = Record<string, any>;

export type ZnfaDisplayResponse = {
  znfa: Record<string, any> | null;
  rfqs: ZnfaDisplayRow[];
  prDet: ZnfaDisplayRow[];
  rfqDet: ZnfaDisplayRow[];
  recommend: ZnfaDisplayRow[];
  attach: ZnfaDisplayRow[];
  nfaTexts: ZnfaDisplayRow[];
  error: string | null;
  sapMessage: string | null;
  fetched_at: string;
};

function empty(error: string | null, sapMessage: string | null = null): ZnfaDisplayResponse {
  return {
    znfa: null,
    rfqs: [],
    prDet: [],
    rfqDet: [],
    recommend: [],
    attach: [],
    nfaTexts: [],
    error,
    sapMessage,
    fetched_at: new Date().toISOString(),
  };
}

function arr(v: unknown): ZnfaDisplayRow[] {
  return Array.isArray(v) ? v.filter((r) => r && typeof r === "object") : [];
}

export const fetchZnfaDisplay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        znfaNum: z.string().trim().min(1, "Main NFA Number is required").max(60),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<ZnfaDisplayResponse> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cfg } = await supabaseAdmin
      .from("sap_api_configs")
      .select("*")
      .eq("name", CONFIG_NAME)
      .maybeSingle();
    if (!cfg)
      throw new Error(`SAP API config "${CONFIG_NAME}" not found. Configure it in Admin → SAP API.`);
    if (!cfg.is_active) throw new Error(`SAP API config "${CONFIG_NAME}" is disabled.`);

    const [{ data: creds }, { data: globalSettings }, { data: globalSecret }] = await Promise.all([
      supabaseAdmin.from("sap_api_credentials").select("*").eq("config_id", cfg.id).maybeSingle(),
      supabaseAdmin
        .from("sap_global_settings")
        .select("connection_mode, middleware_url")
        .eq("id", "default")
        .maybeSingle(),
      supabaseAdmin
        .from("sap_global_secrets")
        .select("proxy_secret")
        .eq("id", "default")
        .maybeSingle(),
    ]);

    const inputs: Record<string, any> = {
      TYPE_NFA: "",
      ZRFQS: [{ RFQ: "" }],
      GET: "",
      REL_CODE: "",
      ZNFA_NUM: data.znfaNum.trim(),
      PRINT: "",
    };

    const globalProxy =
      globalSettings?.connection_mode === "via_proxy" && !!globalSettings?.middleware_url;
    const useProxy = cfg.auth_type === "proxy" || globalProxy;
    const middlewareUrl = globalSettings?.middleware_url?.trim() || null;

    let target: string;
    let method = "POST";
    let bodyOut: string | undefined;
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    let proxied = false;

    if (useProxy) {
      if (!middlewareUrl) throw new Error("Proxy mode is on but no middleware URL is configured.");
      target = `${middlewareUrl.replace(/\/$/, "")}/sap/invoke`;
      const secret =
        (cfg.proxy_secret_ref ? process.env[cfg.proxy_secret_ref] : undefined) ||
        globalSecret?.proxy_secret ||
        process.env.MIDDLEWARE_SHARED_SECRET;
      if (secret) headers["x-shared-secret"] = secret;
      bodyOut = JSON.stringify({ configId: cfg.id, inputs });
      proxied = true;
    } else {
      target = cfg.endpoint_url;
      method = cfg.http_method ?? "POST";
      bodyOut = JSON.stringify(inputs);
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
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms: Date.now() - t0,
        message: `znfa-display network: ${errMsg}`,
      });
      return empty(`Could not reach SAP. ${errMsg}.`);
    }

    const text = await res.text().catch(() => "");
    const message = `${res.status} ${res.statusText}`;
    const latency_ms = Date.now() - t0;

    if (!res.ok) {
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms,
        message: `znfa-display: ${message} ${text.slice(0, 500)}`,
      });
      return empty(`SAP returned ${message}: ${text.slice(0, 200)}`);
    }

    let json: any;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      return empty(`Invalid JSON from SAP: ${text.slice(0, 200)}`);
    }

    const sapJson: any = proxied ? (json?.data ?? json) : json;
    const payload: any = Array.isArray(sapJson) ? sapJson[0] : sapJson;

    const status = String(payload?.STATUS ?? "").toUpperCase();
    const msg = typeof payload?.MSG === "string" ? payload.MSG.trim() : "";
    const znfa =
      payload?.ZNFA && typeof payload.ZNFA === "object" ? (payload.ZNFA as Record<string, any>) : null;

    if (!znfa) {
      if (status === "FALSE" || msg) {
        await supabaseAdmin.from("sap_api_sync_log").insert({
          config_id: cfg.id,
          status: "error",
          latency_ms,
          message: `znfa-display: SAP said "${msg || status}"`,
        });
        return empty(null, msg || "SAP rejected the request.");
      }
      return empty(`Unexpected response from SAP: ${text.slice(0, 200)}`);
    }

    await supabaseAdmin.from("sap_api_sync_log").insert({
      config_id: cfg.id,
      status: "ok",
      latency_ms,
      rows_processed: arr(payload?.PR_DET).length,
      message: `znfa-display: ${message}`,
    });

    return {
      znfa,
      rfqs: arr(payload?.ZRFQS),
      prDet: arr(payload?.PR_DET),
      rfqDet: arr(payload?.RFQ_DET),
      recommend: arr(payload?.RECOMMEND),
      attach: arr(payload?.ATTACH),
      nfaTexts: arr(payload?.NFA_TEXTS),
      error: null,
      sapMessage: null,
      fetched_at: new Date().toISOString(),
    };
  });
