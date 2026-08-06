/**
 * MM ZNFA Release — live SAP fetch of the release / approved list.
 * Config: ZNFA_RELEASE_GET_API (Release) / ZNFA_APPROVE_GET_API (Approved List)
 * Payload: { USER, REL_CODE, CREATE, CHANGE, RELEASE, APP_LIST }
 * Returns: { rows, error, sapMessage, fetched_at }
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const RELEASE_CONFIG_NAME = "ZNFA_RELEASE_GET_API";
const APPROVE_CONFIG_NAME = "ZNFA_APPROVE_GET_API";


export type ZnfaReleaseRow = Record<string, any>;

export type ZnfaReleaseResponse = {
  rows: ZnfaReleaseRow[];
  error: string | null;
  sapMessage: string | null;
  fetched_at: string;
};

function fail(error: string | null, sapMessage: string | null = null): ZnfaReleaseResponse {
  return { rows: [], error, sapMessage, fetched_at: new Date().toISOString() };
}

function extractSapMsg(text: string): string | null {
  if (!text || !text.trim()) return null;
  try {
    const parsed = JSON.parse(text);
    const msg = parsed?.MSG ?? parsed?.data?.MSG ?? parsed?.message ?? parsed?.error;
    return typeof msg === "string" && msg.trim() ? msg.trim() : null;
  } catch {
    const match = text.match(/"MSG"\s*:\s*"([^"]*)"/i);
    return match?.[1] ? match[1] : null;
  }
}

export const fetchZnfaRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        user: z.string().trim().min(1, "SAP user id is required").max(30),
        relCode: z.string().trim().min(1, "Release Code is required").max(10),
        mode: z.enum(["release", "app_list"]).default("release"),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<ZnfaReleaseResponse> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const isAppList = data.mode === "app_list";
    const configName = isAppList ? APPROVE_CONFIG_NAME : RELEASE_CONFIG_NAME;
    const logTag = isAppList ? "znfa-approve" : "znfa-release";

    const { data: cfg } = await supabaseAdmin
      .from("sap_api_configs")
      .select("*")
      .eq("name", configName)
      .maybeSingle();
    if (!cfg)
      throw new Error(`SAP API config "${configName}" not found. Configure it in Admin → SAP API.`);
    if (!cfg.is_active) throw new Error(`SAP API config "${configName}" is disabled.`);

    const [{ data: creds }, { data: globalSettings }, { data: globalSecret }] = await Promise.all([
      supabaseAdmin.from("sap_api_credentials").select("*").eq("config_id", cfg.id).maybeSingle(),
      supabaseAdmin
        .from("sap_global_settings")
        .select("connection_mode, middleware_url")
        .eq("id", "default")
        .maybeSingle(),
      supabaseAdmin.from("sap_global_secrets").select("proxy_secret").eq("id", "default").maybeSingle(),
    ]);

    // isAppList computed above alongside the config name.
    const inputs: Record<string, any> = {
      USER: data.user.trim(),
      REL_CODE: data.relCode.trim(),
      CREATE: "",
      CHANGE: "",
      RELEASE: isAppList ? "" : "X",
      APP_LIST: isAppList ? "X" : "",
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
      // raw: true skips middleware response-field mapping so STATUS/MSG survive.
      bodyOut = JSON.stringify({ configId: cfg.id, inputs, raw: true });
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
        message: `${logTag} network: ${errMsg}`,
      });
      return fail(`Could not reach SAP. ${errMsg}.`);
    }

    const text = await res.text().catch(() => "");
    const message = `${res.status} ${res.statusText}`;
    const latency_ms = Date.now() - t0;

    if (!res.ok) {
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms,
        message: `${logTag}: ${message} ${text.slice(0, 500)}`,
      });
      return fail(null, extractSapMsg(text) ?? "SAP returned an error");
    }

    let json: any;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      return fail(null, extractSapMsg(text) ?? "Invalid response from SAP");
    }

    const sapJson: any = proxied ? (json?.data ?? json) : json;

    const dataArr: any[] | null = Array.isArray(sapJson)
      ? sapJson
      : Array.isArray(sapJson?.DATA)
        ? sapJson.DATA
        : Array.isArray(sapJson?.data)
          ? sapJson.data
          : null;

    if (!dataArr) {
      const status = String(sapJson?.STATUS ?? "").toUpperCase();
      const msg = typeof sapJson?.MSG === "string" ? sapJson.MSG.trim() : "";
      if (status === "FALSE" || msg) {
        await supabaseAdmin.from("sap_api_sync_log").insert({
          config_id: cfg.id,
          status: "error",
          latency_ms,
          message: `${logTag}: SAP said "${msg || status}"`,
        });
        return fail(null, msg || "SAP rejected the request.");
      }
      return fail(null, extractSapMsg(text) ?? "Unexpected response from SAP");
    }

    const rows: ZnfaReleaseRow[] = dataArr.map((r) => (r && typeof r === "object" ? { ...r } : {}));

    await supabaseAdmin.from("sap_api_sync_log").insert({
      config_id: cfg.id,
      status: "ok",
      latency_ms,
      rows_processed: rows.length,
      message: `${logTag}: ${message}`,
    });

    return { rows, error: null, sapMessage: null, fetched_at: new Date().toISOString() };
  });
