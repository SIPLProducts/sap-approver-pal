/**
 * MM ZNFA Release — Print preview. Fetches the NFA PDF from SAP and decodes
 * the Base64 response so the UI can display it inline.
 * Config: ZNFA_PRINT_API
 * Payload: { TYPE_NFA, ZRFQS: [{ RFQ }], GET, REL_CODE, ZNFA_NUM, PRINT }
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CONFIG_NAME = "ZNFA_PRINT_API";

export type ZnfaPrintResponse = {
  /** Base64 data URL that can be used directly in an <iframe> or <embed>. */
  dataUrl: string | null;
  /** Normalized base64 payload (no data: prefix) so the client can build a Blob URL. */
  base64: string | null;
  /** Raw MIME type reported by the SAP response. */
  mimeType: string;
  error: string | null;
  sapMessage: string | null;
};

function okResponse(base64: string, dataUrl: string, mimeType: string): ZnfaPrintResponse {
  return { dataUrl, base64, mimeType, error: null, sapMessage: null };
}

function errorResponse(error: string | null, sapMessage: string | null = null): ZnfaPrintResponse {
  return { dataUrl: null, base64: null, mimeType: "application/pdf", error, sapMessage };
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

function extractBase64Payload(json: any): { base64: string | null; mimeType: string; msg: string | null; status: string | null } {
  const payload: any = Array.isArray(json) ? json[0] : json;
  const status = String(payload?.STATUS ?? payload?.status ?? "").toUpperCase();
  const rawMsg = payload?.MSG ?? payload?.msg;
  const msg = typeof rawMsg === "string" ? rawMsg.trim() : null;

  // Whole response is a plain base64 string (not wrapped in JSON).
  if (typeof payload === "string") {
    return { base64: payload.trim(), mimeType: "application/pdf", msg: null, status: null };
  }

  // Common SAP envelope keys that contain the base64-encoded PDF.
  for (const key of ["PDF", "pdf", "DATA", "data", "FILE", "file", "CONTENT", "content", "BASE64", "base64"]) {
    const candidate = payload?.[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return { base64: candidate.trim(), mimeType: "application/pdf", msg, status };
    }
  }

  return { base64: null, mimeType: "application/pdf", msg, status };
}

function normalizeBase64(base64: string): string {
  // SAP sometimes returns base64 without padding or with URL-safe characters.
  const cleaned = base64.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  return cleaned.padEnd(cleaned.length + ((4 - (cleaned.length % 4)) % 4), "=");
}

export const fetchZnfaPrint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        znfaNum: z.string().trim().min(1, "NFA Number is required").max(60),
        relCode: z.string().trim().max(10).optional().default(""),
        nfaType: z.string().trim().max(20).optional().default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<ZnfaPrintResponse> => {
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
      TYPE_NFA: (data.nfaType ?? "").trim(),
      ZRFQS: [{ RFQ: "" }],
      GET: "",
      REL_CODE: (data.relCode ?? "").trim(),
      ZNFA_NUM: data.znfaNum.trim(),
      PRINT: "X",
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
      // raw: true skips middleware response-field mapping so the full base64 response survives.
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
        message: `znfa-print network: ${errMsg}`,
      });
      return errorResponse(`Could not reach SAP. ${errMsg}.`);
    }

    const text = await res.text().catch(() => "");
    const message = `${res.status} ${res.statusText}`;
    const latency_ms = Date.now() - t0;

    if (!res.ok) {
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms,
        message: `znfa-print: ${message} ${text.slice(0, 500)}`,
      });
      return errorResponse(null, extractSapMsg(text) ?? "SAP returned an error");
    }

    let json: any;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // Not valid JSON — SAP may have returned the base64 string directly.
      json = text;
    }

    const sapJson: any = proxied && json && typeof json === "object" ? (json?.data ?? json) : json;
    const { base64, mimeType, msg, status } = extractBase64Payload(sapJson);

    if (!base64) {
      if (status === "FALSE") {
        await supabaseAdmin.from("sap_api_sync_log").insert({
          config_id: cfg.id,
          status: "error",
          latency_ms,
          message: `znfa-print: SAP said "${msg || status}"`,
        });
        return errorResponse(null, msg || null);
      }
      return errorResponse(null, msg || "SAP did not return a printable document");
    }

    await supabaseAdmin.from("sap_api_sync_log").insert({
      config_id: cfg.id,
      status: "ok",
      latency_ms,
      message: `znfa-print: ok (${Math.round(base64.length / 1024)} KB base64)`,
    });

    return okResponse(decodeBase64ToDataUrl(base64, mimeType), mimeType);
  });
