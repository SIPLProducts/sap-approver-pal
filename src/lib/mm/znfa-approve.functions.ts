/**
 * MM ZNFA Release — Approve / Release an NFA document in SAP.
 * Config: ZNFA_APPROVE_API
 * Payload: { ZNFA_NUM, USER, REL_CODE, NFA_REL, REJECT, REJ_DEL_REASON, DELETE }
 * Returns: { ok, sapMessage, number, error }
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const APPROVE_CONFIG_NAME = "ZNFA_APPROVE_API";
const REJECT_CONFIG_NAME = "ZNFA_REJECT_API";

export type ZnfaApproveResponse = {
  ok: boolean;
  sapMessage: string | null;
  number: string | null;
  error: string | null;
};

function fail(error: string | null, sapMessage: string | null = null): ZnfaApproveResponse {
  return { ok: false, sapMessage, number: null, error };
}

function extractSapMsg(text: string): string | null {
  if (!text || !text.trim()) return null;
  try {
    const parsed = JSON.parse(text);
    const payload = Array.isArray(parsed) ? parsed[0] : parsed;
    const msg = payload?.MSG ?? payload?.data?.MSG ?? payload?.message ?? payload?.error;
    return typeof msg === "string" && msg.trim() ? msg.trim() : null;
  } catch {
    const match = text.match(/"MSG"\s*:\s*"([^"]*)"/i);
    return match?.[1] ? match[1] : null;
  }
}

export const approveZnfa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        znfaNum: z.string().trim().min(1, "NFA number is required").max(60),
        user: z.string().trim().min(1, "SAP user id is required").max(30),
        relCode: z.string().trim().min(1, "Release Code is required").max(10),
        reject: z.boolean().default(false),
        reason: z.string().trim().max(500).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<ZnfaApproveResponse> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const configName = data.reject ? REJECT_CONFIG_NAME : APPROVE_CONFIG_NAME;

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
      supabaseAdmin
        .from("sap_global_secrets")
        .select("proxy_secret")
        .eq("id", "default")
        .maybeSingle(),
    ]);

    const inputs: Record<string, any> = {
      ZNFA_NUM: data.znfaNum.trim(),
      USER: data.user.trim(),
      REL_CODE: data.relCode.trim(),
      NFA_REL: data.reject ? "" : "X",
      REJECT: data.reject ? "X" : "",
      REJ_DEL_REASON: data.reject ? data.reason : "",
      DELETE: "",
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

    const logTag = data.reject ? "znfa-reject" : "znfa-approve-action";
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
    const latency_ms = Date.now() - t0;
    const httpMsg = `${res.status} ${res.statusText}`;

    if (!res.ok) {
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms,
        message: `${logTag}: ${httpMsg} ${text.slice(0, 500)}`,
      });
      return fail(null, extractSapMsg(text) ?? "SAP returned an error");
    }

    let json: any;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      return fail(null, extractSapMsg(text) ?? "Invalid response from SAP");
    }

    const sapJsonRaw: any = proxied ? (json?.data ?? json) : json;
    const sapJson: any = Array.isArray(sapJsonRaw) ? sapJsonRaw[0] : sapJsonRaw;

    const status = String(sapJson?.STATUS ?? "").toUpperCase();
    const msg = typeof sapJson?.MSG === "string" ? sapJson.MSG.trim() : "";
    const number = sapJson?.NUMBER != null ? String(sapJson.NUMBER) : null;

    if (status === "FALSE") {
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms,
        message: `${logTag}: SAP said "${msg || status}"`,
      });
      return fail(null, msg || "SAP rejected the request.");
    }

    await supabaseAdmin.from("sap_api_sync_log").insert({
      config_id: cfg.id,
      status: "ok",
      latency_ms,
      rows_processed: 1,
      message: `${logTag}: ${httpMsg}`,
    });

    return { ok: true, sapMessage: msg || null, number, error: null };
  });
