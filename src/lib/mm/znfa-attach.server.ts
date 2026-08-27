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
/** SAP line tables split documents into short lines (often 132–255 chars). */
const BASE64_CHUNK_MIN_LEN = 8;

function isBase64Charset(value: string): boolean {
  const s = value.trim().replace(/\s+/g, "");
  if (!s) return false;
  return /^(?:data:[^;,]*;base64,)?[A-Za-z0-9+/=_-]+$/.test(s);
}

function looksLikeBase64(value: string): boolean {
  const s = value.trim().replace(/\s+/g, "");
  if (s.length < BASE64_MIN_LEN) return false;
  return isBase64Charset(s);
}

/** Chunk-level test: same charset, but without the standalone length floor. */
function looksLikeBase64Chunk(value: string): boolean {
  const s = value.trim().replace(/\s+/g, "");
  if (s.length < BASE64_CHUNK_MIN_LEN) return false;
  return isBase64Charset(s);
}

/**
 * Joins SAP line-table chunks. Interior "=" padding would truncate the decode
 * (Buffer.from stops at the first pad), so padding is dropped from every chunk
 * and re-applied once at the end.
 */
function joinBase64Chunks(chunks: string[]): string {
  const joined = chunks.map((c) => c.trim().replace(/=+$/, "")).join("");
  return joined.padEnd(joined.length + ((4 - (joined.length % 4)) % 4), "=");
}

function padB64(s: string): string {
  const t = s.replace(/=+$/, "");
  return t.padEnd(t.length + ((4 - (t.length % 4)) % 4), "=");
}

function decodeB64(candidate: string): Buffer | null {
  try {
    const buf = Buffer.from(normalizeBase64(candidate), "base64");
    return buf.length > 8 ? buf : null;
  } catch {
    return null;
  }
}

/**
 * Builds every plausible reassembly of a SAP line table, because SAP may split
 * one continuous Base64 stream OR emit independently padded lines OR hex.
 * Each variant is returned as normalized Base64.
 */
export function candidateVariants(lines: string[]): string[] {
  const clean = lines.map((l) => l.trim()).filter(Boolean);
  if (clean.length === 0) return [];
  const out: string[] = [];
  const push = (v: string | null) => {
    if (v && v.length > 8 && !out.includes(v)) out.push(v);
  };

  // 1) strip per-line padding, join, re-pad once (previous behaviour)
  push(joinBase64Chunks(clean));
  // 2) join verbatim (keeps interior padding)
  push(padB64(clean.join("").replace(/\s+/g, "")));
  // 3) decode each line independently and concatenate the byte buffers
  try {
    const parts = clean.map((l) => Buffer.from(padB64(l.replace(/[^A-Za-z0-9+/=_-]/g, "")), "base64"));
    if (parts.every((p) => p.length > 0)) push(Buffer.concat(parts).toString("base64"));
  } catch {
    /* ignore */
  }
  // 4) hex XSTRING lines
  if (clean.every((l) => /^[0-9a-fA-F]+$/.test(l) && l.length % 2 === 0)) {
    try {
      push(Buffer.from(clean.join(""), "hex").toString("base64"));
    } catch {
      /* ignore */
    }
  }
  return out;
}

/**
 * Ranks a decoded payload: complete PDF > PDF > recognised magic > unknown.
 */
export function scoreCandidate(candidate: string): number {
  const bytes = decodeB64(candidate);
  if (!bytes) return 0;
  const head = bytes.subarray(0, 5).toString("latin1");
  if (head.startsWith("%PDF")) {
    const tail = bytes.subarray(Math.max(0, bytes.length - 2048)).toString("latin1");
    return tail.includes("%%EOF") ? 4 : 3;
  }
  return sniffMimeFromBytes(bytes) ? 2 : 1;
}


/** Detect the real file type from the decoded magic bytes. */
export function sniffMimeFromBytes(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b.length < 4) return null;
  const ascii = (n: number) =>
    Array.from(b.subarray(0, n))
      .map((c) => String.fromCharCode(c))
      .join("");
  if (ascii(5).startsWith("%PDF")) return "application/pdf";
  if (b[0] === 0x50 && b[1] === 0x4b) return "application/zip"; // also docx/xlsx/pptx
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0)
    return "application/msword"; // legacy OLE Office / .msg
  if (b[0] === 0x89 && ascii(4).slice(1) === "PNG") return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (ascii(4) === "GIF8") return "image/gif";
  if (ascii(4) === "{\\rt") return "application/rtf";
  return null;
}

/** Structural PDF health for logs/UI: header + trailer presence only. */
export function describePdfBytes(bytes: Uint8Array): { isPdf: boolean; hasTrailer: boolean } {
  const buf = Buffer.from(bytes);
  const isPdf = buf.subarray(0, 4).toString("latin1") === "%PDF";
  const hasTrailer = buf
    .subarray(Math.max(0, buf.length - 2048))
    .toString("latin1")
    .includes("%%EOF");
  return { isPdf, hasTrailer };
}

/**
 * Recursively finds the longest base64-looking string in the response. Arrays
 * whose items each carry a base64-ish chunk (SAP line tables) are joined in
 * order before being compared.
 */
/** True when the base64 decodes to a PDF whose trailer (%%EOF) is present. */
function isCompletePdf(candidate: string): boolean {
  try {
    const bytes = Buffer.from(normalizeBase64(candidate), "base64");
    if (bytes.length < 8) return false;
    if (bytes.subarray(0, 4).toString("latin1") !== "%PDF") return false;
    return bytes.subarray(Math.max(0, bytes.length - 1024)).toString("latin1").includes("%%EOF");
  } catch {
    return false;
  }
}

/** SAP sequence/line-number columns used to order line-table rows. */
const SEQ_KEYS = ["LINE_NO", "LINENO", "LINE", "SEQ", "SEQNR", "SEQ_NO", "ZEILE", "NO", "INDEX"];

function seqOf(item: any): number | null {
  if (!item || typeof item !== "object") return null;
  for (const k of SEQ_KEYS) {
    const raw = item[k] ?? item[k.toLowerCase()];
    if (raw == null) continue;
    const n = Number(String(raw).trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Order rows by an explicit sequence column when every row carries one. */
function orderRows(rows: any[]): any[] {
  const seqs = rows.map(seqOf);
  if (seqs.some((s) => s == null)) return rows;
  return rows
    .map((r, i) => ({ r, s: seqs[i] as number, i }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((x) => x.r);
}

function findDeepBase64(node: any, depth = 0): string | null {
  if (depth > 8 || node == null) return null;
  if (typeof node === "string") return looksLikeBase64(node) ? node.trim() : null;
  if (typeof node !== "object") return null;

  let best: string | null = null;
  const consider = (candidate: string | null) => {
    if (!candidate) return;
    if (!best) {
      best = candidate;
      return;
    }
    // Rank by decoded content first (complete PDF beats a truncated or
    // misaligned payload), and only then by size.
    const cs = scoreCandidate(candidate);
    const bs = scoreCandidate(best);
    if (cs !== bs) {
      if (cs > bs) best = candidate;
      return;
    }
    if (candidate.length > best.length) best = candidate;
  };
  /** Consider every plausible reassembly of a set of line-table lines. */
  const considerLines = (lines: string[]) => {
    for (const variant of candidateVariants(lines)) consider(variant);
  };


  if (Array.isArray(node)) {
    // Chunked line table: join every chunk found directly on the items, in the
    // SAP sequence order when the rows carry one.
    const rows = orderRows(node);
    const stringChunks: string[] = [];
    const byKey = new Map<string, string[]>();
    for (const item of rows) {
      if (typeof item === "string" && looksLikeBase64Chunk(item)) {
        stringChunks.push(item.trim());
      } else if (item && typeof item === "object" && !Array.isArray(item)) {
        for (const [k, v] of Object.entries(item)) {
          // Keep every line of a column, including a short final line — the
          // file tail (and the %%EOF trailer) lives there.
          if (typeof v === "string" && v.trim() && isBase64Charset(v)) {
            const list = byKey.get(k) ?? [];
            list.push(v.trim());
            byKey.set(k, list);
          }
        }
      }
    }
    if (stringChunks.length > 1) consider(joinBase64Chunks(stringChunks));
    // Pick document columns only: a column of pure numbers (line numbers) or a
    // column whose total size is a small fraction of the largest one is metadata.
    const totals = new Map<string, number>();
    for (const [k, list] of byKey) {
      const numericOnly = list.every((v) => /^\d+$/.test(v));
      const hasLongLine = list.some((v) => v.length >= BASE64_CHUNK_MIN_LEN * 4);
      if (numericOnly || !hasLongLine) continue;
      totals.set(
        k,
        list.reduce((n, v) => n + v.length, 0),
      );
    }
    const maxTotal = Math.max(0, ...totals.values());
    for (const [k, total] of totals) {
      if (maxTotal > 0 && total < maxTotal / 4) continue;
      const list = byKey.get(k)!;
      if (list.length > 1) consider(joinBase64Chunks(list));
      else if (list.length === 1 && looksLikeBase64(list[0]!)) consider(list[0]!);
    }
    for (const item of rows) consider(findDeepBase64(item, depth + 1));
    return best;
  }

  for (const value of Object.values(node)) consider(findDeepBase64(value, depth + 1));
  return best;
}

/**
 * Structural description of a SAP response for logs: key paths, array lengths
 * and string lengths only — never any content.
 */
export function describeShape(node: any, depth = 0): string {
  if (depth > 6) return "…";
  if (node == null) return String(node);
  if (typeof node === "string") return `string(${node.length})`;
  if (typeof node !== "object") return typeof node;
  if (Array.isArray(node)) {
    const first = node.length > 0 ? describeShape(node[0], depth + 1) : "";
    return `array(${node.length})${first ? `[${first}]` : ""}`;
  }
  const parts = Object.entries(node)
    .slice(0, 25)
    .map(([k, v]) => `${k}:${describeShape(v, depth + 1)}`);
  return `{${parts.join(", ")}}`;
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
