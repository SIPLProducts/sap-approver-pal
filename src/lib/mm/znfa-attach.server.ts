/**
 * Server-only helpers for the ZNFA attachment APIs. Resolves the SAP API
 * config (direct or via the middleware proxy) and invokes it, mirroring the
 * behaviour of znfa-print.functions.ts.
 */

export type ZnfaAttachInvokeResult = {
  json: any;
  error: string | null;
  sapMessage: string | null;
};

/** Strip JSON quoting, escapes and any data: prefix, keeping only base64 characters. */
export function cleanBase64(raw: string): { base64: string; mimeFromPrefix: string | null } {
  let s = raw.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  s = s.replace(/^["']+/, "").replace(/["']+$/, "");
  let mimeFromPrefix: string | null = null;
  const prefix = s.match(/^data:([^;,]+)?;base64,/i);
  if (prefix) {
    mimeFromPrefix = prefix[1]?.trim() || null;
    s = s.slice(prefix[0].length);
  }
  s = s.replace(/\\[nrt"'\\/]/g, "").replace(/[^A-Za-z0-9+/=_-]/g, "");
  return { base64: s, mimeFromPrefix };
}

export function normalizeBase64(base64: string): string {
  const cleaned = cleanBase64(base64)
    .base64.replace(/-/g, "+")
    .replace(/_/g, "/")
    .replace(/=+$/, "");
  return cleaned.padEnd(cleaned.length + ((4 - (cleaned.length % 4)) % 4), "=");
}

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  txt: "text/plain",
  csv: "text/csv",
  zip: "application/zip",
};

export function extractBase64Payload(json: any): {
  base64: string | null;
  mimeType: string;
  msg: string | null;
} {
  let root: any = json;
  if (typeof root === "string") {
    const trimmed = root.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        root = JSON.parse(trimmed);
      } catch {
        /* keep the raw string */
      }
    }
  }
  const payload: any = Array.isArray(root) ? root[0] : root;

  if (typeof payload === "string") {
    const { base64, mimeFromPrefix } = cleanBase64(payload);
    return { base64, mimeType: mimeFromPrefix ?? "application/pdf", msg: null };
  }


  const rawMsg = payload?.MSG ?? payload?.msg;
  const msg = typeof rawMsg === "string" && rawMsg.trim() ? rawMsg.trim() : null;
  const ext = String(payload?.FILE_EXT ?? payload?.file_ext ?? "")
    .trim()
    .toLowerCase();
  const fallbackMime = MIME_BY_EXT[ext] ?? "application/pdf";

  for (const key of [
    "PDF",
    "pdf",
    "DATA",
    "data",
    "FILE",
    "file",
    "CONTENT",
    "content",
    "BASE64",
    "base64",
    "ATTACHMENT",
    "attachment",
  ]) {
    const candidate = payload?.[key];
    if (typeof candidate === "string" && candidate.trim()) {
      const { base64, mimeFromPrefix } = cleanBase64(candidate);
      if (base64) return { base64, mimeType: mimeFromPrefix ?? fallbackMime, msg };
    }
  }

  // Fallback: SAP may return the document under an unexpected key, nested, or
  // split across line-table chunks. Search the whole response for the largest
  // base64-looking payload (chunks under the same array are concatenated).
  const deep = findDeepBase64(root);
  if (deep) {
    const { base64, mimeFromPrefix } = cleanBase64(deep);
    if (base64) return { base64, mimeType: mimeFromPrefix ?? fallbackMime, msg };
  }

  return { base64: null, mimeType: fallbackMime, msg };
}

const BASE64_MIN_LEN = 200;

function looksLikeBase64(value: string): boolean {
  const s = value.trim().replace(/\s+/g, "");
  if (s.length < BASE64_MIN_LEN) return false;
  return /^(?:data:[^;,]*;base64,)?[A-Za-z0-9+/=_-]+$/.test(s);
}

/**
 * Recursively finds the longest base64-looking string in the response. Arrays
 * whose items each carry a base64-ish chunk (SAP line tables) are joined in
 * order before being compared.
 */
function findDeepBase64(node: any, depth = 0): string | null {
  if (depth > 8 || node == null) return null;
  if (typeof node === "string") return looksLikeBase64(node) ? node.trim() : null;
  if (typeof node !== "object") return null;

  let best: string | null = null;
  const consider = (candidate: string | null) => {
    if (candidate && (!best || candidate.length > best.length)) best = candidate;
  };

  if (Array.isArray(node)) {
    // Chunked line table: join every chunk found directly on the items.
    const chunks: string[] = [];
    for (const item of node) {
      if (typeof item === "string" && looksLikeBase64(item)) {
        chunks.push(item.trim());
      } else if (item && typeof item === "object" && !Array.isArray(item)) {
        for (const v of Object.values(item)) {
          if (typeof v === "string" && looksLikeBase64(v)) {
            chunks.push(v.trim());
            break;
          }
        }
      }
    }
    if (chunks.length > 1) consider(chunks.join(""));
    for (const item of node) consider(findDeepBase64(item, depth + 1));
    return best;
  }

  for (const value of Object.values(node)) consider(findDeepBase64(value, depth + 1));
  return best;
}


function extractSapMsg(json: any): string | null {
  const payload: any = Array.isArray(json) ? json[0] : json;
  if (!payload || typeof payload !== "object") return null;
  const candidates = [payload.MSG, payload.MSGTXT, payload.MESSAGE, payload.msg, payload.message];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

/**
 * Invokes a ZNFA attachment SAP API config by name with the given payload.
 */
export async function invokeZnfaAttachApi(
  configName: string,
  payload: unknown,
  logTag: string,
): Promise<ZnfaAttachInvokeResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: cfg, error: cfgErr } = await supabaseAdmin
    .from("sap_api_configs")
    .select("*")
    .eq("name", configName)
    .maybeSingle();
  if (cfgErr) console.error(`[${logTag}] config lookup failed:`, cfgErr.message);
  if (!cfg) {
    return {
      json: null,
      error: `SAP API config "${configName}" not found. Configure it in Admin → SAP API.`,
      sapMessage: null,
    };
  }
  if (!cfg.is_active) {
    return { json: null, error: `SAP API config "${configName}" is disabled.`, sapMessage: null };
  }

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

  const globalProxy =
    globalSettings?.connection_mode === "via_proxy" && !!globalSettings?.middleware_url;
  const useProxy = cfg.auth_type === "proxy" || globalProxy;
  const middlewareUrl = globalSettings?.middleware_url?.trim() || null;

  let target: string;
  let method = cfg.http_method ?? "POST";
  let bodyOut: string | undefined;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (useProxy) {
    if (!middlewareUrl) {
      return {
        json: null,
        error: "Proxy mode is on but no middleware URL is configured.",
        sapMessage: null,
      };
    }
    // SAP expects a JSON array body; /sap/raw-invoke forwards it verbatim
    // (no request-field mapping, no response mapping).
    target = `${middlewareUrl.replace(/\/$/, "")}/sap/raw-invoke`;
    method = "POST";
    const secret =
      (cfg.proxy_secret_ref ? process.env[cfg.proxy_secret_ref] : undefined) ||
      globalSecret?.proxy_secret ||
      process.env.MIDDLEWARE_SHARED_SECRET;
    if (secret) headers["x-shared-secret"] = secret;
    bodyOut = JSON.stringify({ configId: cfg.id, configName: cfg.name, inputs: payload });

  } else {
    target = cfg.endpoint_url;
    bodyOut = JSON.stringify(payload);
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
    return { json: null, error: `Could not reach SAP. ${errMsg}.`, sapMessage: null };
  }

  const text = await res.text().catch(() => "");
  const latency_ms = Date.now() - t0;

  if (!res.ok) {
    await supabaseAdmin.from("sap_api_sync_log").insert({
      config_id: cfg.id,
      status: "error",
      latency_ms,
      message: `${logTag}: ${res.status} ${res.statusText} ${text.slice(0, 500)}`,
    });
    let parsedErr: any = null;
    try {
      parsedErr = text ? JSON.parse(text) : null;
    } catch {
      parsedErr = null;
    }
    return {
      json: null,
      error: extractSapMsg(parsedErr) ?? `SAP returned an error (${res.status}).`,
      sapMessage: null,
    };
  }

  let json: any;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  const sapJson: any = useProxy && json && typeof json === "object" ? (json?.data ?? json) : json;

  await supabaseAdmin.from("sap_api_sync_log").insert({
    config_id: cfg.id,
    status: "ok",
    latency_ms,
    message: `${logTag}: ok`,
  });

  return { json: sapJson, error: null, sapMessage: extractSapMsg(sapJson) };
}
