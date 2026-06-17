// SAP Middleware — single-file Node.js (Express) service.
// Sits between SAP and the Lovable app. Holds NO database credentials:
// it calls the app's public middleware endpoints
// (POST /api/public/middleware/config and /log) with a shared-secret
// header, and forwards the resolved config to SAP.
//
// Routes:
//   GET  /__health     — public liveness probe
//   POST /sap/test     — probes a configured SAP endpoint (auth: x-shared-secret)
//   POST /sap/invoke   — runs a configured SAP API call    (auth: x-shared-secret)

import "dotenv/config";
import express from "express";
import cors from "cors";
import { z } from "zod";

// ---------- env ----------
const PORT = parseInt(process.env.PORT || "3005", 10);

// Shared secret — MUST match MIDDLEWARE_SHARED_SECRET secret on the
// Lovable app side AND "Proxy Secret / Password" in SAP API Settings →
// Middleware Configuration tab.
const SHARED_SECRET =
  process.env.MIDDLEWARE_SHARED_SECRET || process.env.SHARED_SECRET || "";

// Base URL of the Lovable app. Used to fetch SAP configs and write sync log.
// Examples:
//   https://id-preview--<project-id>.lovable.app   (preview)
//   https://project--<project-id>.lovable.app      (published / stable)
const APP_BASE_URL = (process.env.APP_BASE_URL || "").replace(/\/+$/, "");

// Optional offline smoke-test mode. When MIDDLEWARE_MOCK=1, the middleware
// skips the app call and builds a config from SAP_BP_* env vars below.
const MOCK_MODE = process.env.MIDDLEWARE_MOCK === "1";

// Timeouts.
const TIMEOUT_MS         = parseInt(process.env.SAP_REQUEST_TIMEOUT_MS || "120000", 10);
const CONNECT_TIMEOUT_MS = parseInt(process.env.SAP_CONNECT_TIMEOUT_MS || "60000", 10);
const HEADERS_TIMEOUT_MS = parseInt(process.env.SAP_HEADERS_TIMEOUT_MS || "60000", 10);
const BODY_TIMEOUT_MS    = parseInt(process.env.SAP_BODY_TIMEOUT_MS    || "60000", 10);

// Optional SAP fallbacks — only used in MOCK_MODE or when the app returns
// a row without URL/credentials.
const FALLBACK_BP_URL      = process.env.SAP_BP_API_URL  || "";
const FALLBACK_DMS_URL     = process.env.SAP_DMS_API_URL || FALLBACK_BP_URL;
const FALLBACK_BP_USERNAME = process.env.SAP_BP_USERNAME || "";
const FALLBACK_BP_PASSWORD = process.env.SAP_BP_PASSWORD || "";

if (!SHARED_SECRET) {
  console.error("[fatal] MIDDLEWARE_SHARED_SECRET is required.");
  process.exit(1);
}
if (!MOCK_MODE && !APP_BASE_URL) {
  console.error(
    "[fatal] APP_BASE_URL is required (or set MIDDLEWARE_MOCK=1 for offline mode).",
  );
  process.exit(1);
}

// ---------- shared-secret auth (incoming) ----------
function requireSharedSecret(req, res, next) {
  const got = req.header("x-shared-secret");
  if (!got || got !== SHARED_SECRET) {
    return res.status(401).json({ ok: false, error: "Invalid or missing x-shared-secret" });
  }
  next();
}

// ---------- app-side calls (config + log) ----------
async function appFetch(path, body) {
  const res = await fetch(`${APP_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-shared-secret": SHARED_SECRET,
    },
    body: JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  // Detect auth-gated hosts (id-preview--*.lovable.app) that 302 to auth-bridge.
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location") || "";
    throw new Error(
      `APP_BASE_URL is auth-gated (redirected to ${loc || "an auth page"}). ` +
      `Use the STABLE host instead — e.g. https://project--<project-id>-dev.lovable.app ` +
      `(preview) or https://project--<project-id>.lovable.app (published). ` +
      `Never use the id-preview--... host.`,
    );
  }

  const contentType = res.headers.get("content-type") || "";
  const rawText = await res.text();

  if (!contentType.includes("application/json")) {
    throw new Error(
      `${path} returned non-JSON (HTTP ${res.status}, content-type=${contentType || "unknown"}). ` +
      `APP_BASE_URL is likely wrong or auth-gated. ` +
      `Use https://project--<project-id>-dev.lovable.app instead of id-preview--... ` +
      `First 120 chars: ${rawText.slice(0, 120)}`,
    );
  }

  let json;
  try {
    json = JSON.parse(rawText);
  } catch {
    throw new Error(`${path} returned invalid JSON (HTTP ${res.status})`);
  }

  if (!res.ok || !json.ok) {
    throw new Error(json.error || `${path} failed: HTTP ${res.status}`);
  }
  return json;
}


// ---------- config loader (30s cache) ----------
const TTL_MS = 30_000;
const configCache = new Map();

function buildMockConfig(configId) {
  const url = FALLBACK_BP_URL || FALLBACK_DMS_URL;
  if (!url) throw new Error("MOCK_MODE: no SAP_BP_API_URL configured");
  return {
    id: configId,
    name: "mock",
    module: "COMMON",
    endpoint_url: url,
    http_method: "GET",
    auth_type: FALLBACK_BP_USERNAME ? "basic" : "none",
    is_active: true,
    updated_at: new Date().toISOString(),
    credentials: {
      username: FALLBACK_BP_USERNAME || null,
      password: FALLBACK_BP_PASSWORD || null,
      extra_headers: {},
    },
    requestFields: [],
    responseFields: [],
  };
}

async function loadConfig(key) {
  // `key` is either a UUID configId or a config name (e.g. "Price_Approval_Fetch").
  const cached = configCache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.cfg;

  let cfg;
  if (MOCK_MODE) {
    cfg = buildMockConfig(key);
  } else {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
    const body = isUuid ? { configId: key } : { name: key };
    const json = await appFetch("/api/public/middleware/config", body);
    cfg = json.config;
  }

  // Apply per-module URL fallback if app returned no endpoint_url.
  if (!cfg.endpoint_url) {
    cfg.endpoint_url =
      cfg.module === "MM" ? FALLBACK_DMS_URL : FALLBACK_BP_URL;
  }
  // Apply credential fallbacks.
  cfg.credentials = cfg.credentials || { extra_headers: {} };
  if (!cfg.credentials.username) cfg.credentials.username = FALLBACK_BP_USERNAME || null;
  if (!cfg.credentials.password) cfg.credentials.password = FALLBACK_BP_PASSWORD || null;
  cfg.credentials.extra_headers = cfg.credentials.extra_headers || {};

  if (!cfg.endpoint_url) {
    throw new Error(`Config ${key} has no endpoint_url and no fallback env URL is set`);
  }

  // Cache under both the lookup key and the resolved id so subsequent calls hit it either way.
  configCache.set(key, { at: Date.now(), cfg });
  if (cfg.id && cfg.id !== key) configCache.set(cfg.id, { at: Date.now(), cfg });
  return cfg;
}

async function writeLog(entry) {
  if (MOCK_MODE) return;
  try {
    await appFetch("/api/public/middleware/log", entry);
  } catch (e) {
    console.error("[log] failed", e.message);
  }
}

// ---------- field mapping ----------
function evalExpr(expr, inputs) {
  let out = expr || "";
  out = out.replace(/today\(\)/g, new Date().toISOString().slice(0, 10));
  out = out.replace(/now\(\)/g, new Date().toISOString());
  out = out.replace(/\$\{input\.([a-zA-Z0-9_]+)\}/g, (_, k) => {
    const v = inputs[k];
    return v == null ? "" : String(v);
  });
  return out;
}

function resolveRequestField(field, inputs) {
  switch (field.source) {
    case "static": return field.default_value ?? null;
    case "column": return inputs[field.field_name] ?? field.default_value ?? null;
    case "secret": return field.default_value ? process.env[field.default_value] ?? null : null;
    case "expr":   return evalExpr(field.default_value ?? "", inputs);
    default:       return null;
  }
}

function buildRequestPayload(fields, inputs) {
  const payload = {};
  const missing = [];
  for (const f of fields) {
    const value = resolveRequestField(f, inputs);
    if (f.required && (value === null || value === undefined || value === "")) {
      missing.push(f.field_name);
    }
    payload[f.field_name] = value;
  }
  if (missing.length) throw new Error(`Missing required field(s): ${missing.join(", ")}`);
  return payload;
}

function getByPath(obj, path) {
  return path.split(".").reduce((acc, k) => {
    if (acc && typeof acc === "object") return acc[k];
    return undefined;
  }, obj);
}

function mapResponse(fields, raw) {
  // List responses: SAP returns { DATA: [...] } or { data: [...] } — pass
  // the payload through unchanged so the calling app can iterate the rows
  // and apply per-row mapping itself. Field mapping at the middleware level
  // only makes sense for single-object responses.
  if (raw && typeof raw === "object") {
    if (Array.isArray(raw.DATA) || Array.isArray(raw.data) || Array.isArray(raw)) {
      return raw;
    }
  }
  if (!fields.length) return raw;
  const root = raw && typeof raw === "object" ? raw : {};
  const out = {};
  for (const f of fields) {
    out[f.target_column ?? f.field_name] = getByPath(root, f.field_name);
  }
  return out;
}

// ---------- SAP invoker ----------
const oauthTokenCache = new Map();

async function getOauthToken(cfg) {
  const cached = oauthTokenCache.get(cfg.id);
  if (cached && cached.expiresAt > Date.now() + 5_000) return cached.token;

  const tokenUrl = cfg.credentials.extra_headers?.oauth_token_url;
  if (!tokenUrl || !cfg.credentials.username || !cfg.credentials.password) return null;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: cfg.credentials.username,
    client_secret: cfg.credentials.password,
  });
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    console.error("[oauth] token fetch failed", res.status);
    return null;
  }
  const json = await res.json();
  if (!json.access_token) return null;
  oauthTokenCache.set(cfg.id, {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  });
  return json.access_token;
}

async function buildAuthHeaders(cfg) {
  const headers = {};
  if (cfg.auth_type === "basic" && cfg.credentials.username && cfg.credentials.password) {
    const token = Buffer.from(`${cfg.credentials.username}:${cfg.credentials.password}`).toString("base64");
    headers.Authorization = `Basic ${token}`;
  } else if (cfg.auth_type === "oauth") {
    const token = await getOauthToken(cfg);
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function fetchWithTimeout(url, init) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError") {
      const err = new Error(`SAP request timed out after ${TIMEOUT_MS}ms`);
      err.code = "ETIMEDOUT";
      throw err;
    }
    throw e;
  }
}

// SAP sometimes returns malformed JSON with empty values like
// `"ADV_DOC_NUM": { "ZEILE": , "EBELP": }`. Try strict parse first, then
// sanitize the empty-value pattern and retry. If both fail, surface the raw
// text so the app can see what SAP actually sent (instead of silently null).
function safeParseSapJson(text) {
  if (text == null || text === "") return null;
  try { return JSON.parse(text); } catch {}
  const sanitized = text
    .replace(/:\s*,/g, ": null,")
    .replace(/:\s*\}/g, ": null}")
    .replace(/:\s*\]/g, ": null]");
  try { return JSON.parse(sanitized); } catch (e) {
    return { __parse_error: e.message, __raw_preview: String(text).slice(0, 1000) };
  }
}


async function invokeSap(cfg, inputs) {
  const payload = buildRequestPayload(cfg.requestFields, inputs);
  const url = new URL(cfg.endpoint_url);

  const headers = {
    Accept: "application/json",
    ...cfg.credentials.extra_headers,
    ...(await buildAuthHeaders(cfg)),
  };

  let body;
  if (["GET", "DELETE", "HEAD"].includes(cfg.http_method)) {
    for (const [k, v] of Object.entries(payload)) {
      if (v != null) url.searchParams.set(k, String(v));
    }
  } else {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
    body = JSON.stringify(payload);
  }

  const t0 = Date.now();
  const res = await fetchWithTimeout(url.toString(), { method: cfg.http_method, headers, body });
  const latency_ms = Date.now() - t0;

  const contentType = res.headers.get("content-type") ?? "";
  const raw = contentType.includes("application/json")
    ? await res.json().catch(() => null)
    : await res.text().catch(() => "");

  const data = mapResponse(cfg.responseFields, raw);
  return { ok: res.ok, status: res.status, latency_ms, data };
}

async function probeSap(cfg) {
  const headers = {
    Accept: "application/json",
    ...cfg.credentials.extra_headers,
    ...(await buildAuthHeaders(cfg)),
  };
  const t0 = Date.now();
  try {
    const res = await fetchWithTimeout(cfg.endpoint_url, { method: "HEAD", headers });
    return {
      ok: res.ok,
      status: res.status,
      latency_ms: Date.now() - t0,
      message: `${res.status} ${res.statusText}`,
    };
  } catch (e) {
    return { ok: false, status: 0, latency_ms: Date.now() - t0, message: e.message };
  }
}

// ---------- app ----------
const app = express();
app.use(cors({ origin: true, allowedHeaders: ["Content-Type", "x-shared-secret"] }));
app.use(express.json({ limit: "1mb" }));

// Request logger — prints every incoming request URL, headers (redacted),
// and JSON body so the operator can see exactly what the app is sending.
app.use((req, _res, next) => {
  if (req.path === "/__health") return next();
  const redactedHeaders = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (/^(authorization|x-shared-secret)$/i.test(k)) redactedHeaders[k] = "***redacted***";
    else redactedHeaders[k] = v;
  }
  console.log(`\n[request] ${req.method} ${req.originalUrl}`);
  console.log(`[request] headers=`, redactedHeaders);
  if (req.body && Object.keys(req.body).length) {
    try {
      console.log(`[request] body=`, JSON.stringify(req.body, null, 2));
    } catch {
      console.log(`[request] body=<unserializable>`);
    }
  }
  next();
});


// Health
app.get("/__health", (_req, res) => {
  res.json({
    ok: true,
    service: "sap-middleware",
    mode: MOCK_MODE ? "mock" : "live",
    app_base_url: MOCK_MODE ? null : APP_BASE_URL,
    time: new Date().toISOString(),
  });
});

// Test connection
const TestBody = z.object({ configId: z.string().uuid() });
app.post("/sap/test", requireSharedSecret, async (req, res) => {
  const parsed = TestBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.message });

  try {
    const cfg = await loadConfig(parsed.data.configId);
    const result = await probeSap(cfg);
    await writeLog({
      configId: parsed.data.configId,
      status: result.ok ? "ok" : "error",
      latency_ms: result.latency_ms,
      message: `test: ${result.message}`,
    });
    return res.json(result);
  } catch (e) {
    console.error("[test] failed", e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Invoke
const InvokeBody = z.object({
  configId: z.string().uuid(),
  inputs: z.record(z.string(), z.unknown()).optional().default({}),
});
app.post("/sap/invoke", requireSharedSecret, async (req, res) => {
  const parsed = InvokeBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.message });
  const { configId, inputs } = parsed.data;

  try {
    const cfg = await loadConfig(configId);
    const result = await invokeSap(cfg, inputs);
    await writeLog({
      configId,
      status: result.ok ? "ok" : "error",
      latency_ms: result.latency_ms,
      message: `invoke: ${result.status}`,
    });
    return res.status(result.ok ? 200 : 502).json(result);
  } catch (e) {
    console.error("[invoke] failed", e.message);
    await writeLog({
      configId,
      status: "error",
      latency_ms: 0,
      message: `invoke: ${e.message}`.slice(0, 500),
    });
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ---------- Named business endpoints ----------
// These aliases make the middleware log human-readable. Each one resolves a
// config by NAME (not UUID) via the same /api/public/middleware/config route,
// then runs the same invoke pipeline as /sap/invoke. Add a new route here
// whenever you wire a new SAP API into the app.
const NamedInvokeBody = z.object({
  inputs: z.record(z.string(), z.unknown()).optional().default({}),
});

function namedInvokeRoute(path, configName) {
  app.post(path, requireSharedSecret, async (req, res) => {
    const parsed = NamedInvokeBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.message });
    const { inputs } = parsed.data;

    let cfgId = null;
    try {
      const cfg = await loadConfig(configName);
      cfgId = cfg.id;
      console.log(`[${path}] config name=${cfg.name} id=${cfg.id} url=${cfg.endpoint_url} method=${cfg.http_method}`);
      console.log(`[${path}] inputs from app =`, JSON.stringify(inputs));
      const result = await invokeSap(cfg, inputs);
      const preview = typeof result.data === "string"
        ? result.data.slice(0, 500)
        : JSON.stringify(result.data).slice(0, 500);
      console.log(`[${path}] sap status=${result.status} latency=${result.latency_ms}ms body=`, preview);
      await writeLog({
        configId: cfg.id,
        status: result.ok ? "ok" : "error",
        latency_ms: result.latency_ms,
        message: `${path}: ${result.status} ${preview.slice(0, 200)}`,
      });
      if (!result.ok) {
        return res.status(502).json({
          ok: false,
          status: result.status,
          latency_ms: result.latency_ms,
          error: `SAP returned ${result.status}`,
          data: result.data,
        });
      }
      return res.status(200).json(result);
    } catch (e) {
      console.error(`[${path}] failed`, e.message);
      if (cfgId) {
        await writeLog({
          configId: cfgId,
          status: "error",
          latency_ms: 0,
          message: `${path}: ${e.message}`.slice(0, 500),
        });
      }
      return res.status(500).json({ ok: false, error: e.message });
    }
  });
}

// Raw passthrough invoker — sends inputs verbatim as the SAP request body.
// Used for write endpoints (e.g. Approve/Reject) where the caller has already
// shaped the exact SAP payload and field mapping must NOT be applied.
async function invokeSapRaw(cfg, rawBody) {
  const url = cfg.endpoint_url;
  const method = (cfg.http_method || "PUT").toUpperCase();
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...cfg.credentials.extra_headers,
    ...(await buildAuthHeaders(cfg)),
  };
  const body = JSON.stringify(rawBody);
  console.log(`[raw-invoke] ${method} ${url} payload=`, body);
  const t0 = Date.now();
  const res = await fetchWithTimeout(url, { method, headers, body });
  const latency_ms = Date.now() - t0;
  const contentType = res.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json")
    ? await res.json().catch(() => null)
    : await res.text().catch(() => "");
  console.log(`[raw-invoke] ${method} ${url} status=${res.status} body=`,
    typeof data === "string" ? data.slice(0, 500) : JSON.stringify(data).slice(0, 500));
  return { ok: res.ok, status: res.status, latency_ms, data };
}

function namedRawInvokeRoute(path, configName) {
  app.post(path, requireSharedSecret, async (req, res) => {
    const parsed = NamedInvokeBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.message });
    const { inputs } = parsed.data;

    let cfgId = null;
    try {
      const cfg = await loadConfig(configName);
      cfgId = cfg.id;
      const result = await invokeSapRaw(cfg, inputs);
      await writeLog({
        configId: cfg.id,
        status: result.ok ? "ok" : "error",
        latency_ms: result.latency_ms,
        message: `${path}: ${result.status}`,
      });
      return res.status(result.ok ? 200 : 502).json(result);
    } catch (e) {
      console.error(`[${path}] failed`, e.message);
      if (cfgId) {
        await writeLog({
          configId: cfgId,
          status: "error",
          latency_ms: 0,
          message: `${path}: ${e.message}`.slice(0, 500),
        });
      }
      return res.status(500).json({ ok: false, error: e.message });
    }
  });
}

// SD — Price Approvals
namedInvokeRoute("/price_approval/Fetch",                "Price_Approval_Fetch");
namedRawInvokeRoute("/price_approval/Price_Approve_Reject", "Price_Approve_Reject");

// SD — Contract Approvals
namedInvokeRoute("/contract_approval/Fetch",                      "Contract_Approval_Fetch");
namedRawInvokeRoute("/contract_approval/Contract_Approve_Reject", "Contract_Approve_Reject");

// SD — Sales Order Approvals
namedInvokeRoute("/sales_order_approval/Fetch",                   "Sales_Approval_Fetch");
namedRawInvokeRoute("/sales_order_approval/Sales_Approve_Reject", "Sales_Approve_Reject");

// SD — Service Certificate & SO Approvals (raw passthrough; sends inputs verbatim)
namedRawInvokeRoute("/service_certificate/Fetch", "Sevice_Certificate_Fetch");




// Error handler
app.use((err, _req, res, _next) => {
  console.error("[unhandled]", err.message);
  res.status(500).json({ ok: false, error: err.message });
});

const server = app.listen(PORT, () => {
  console.log(`[sap-middleware] listening on :${PORT} (${MOCK_MODE ? "mock" : "live"} mode)`);
  if (!MOCK_MODE) console.log(`[sap-middleware] app: ${APP_BASE_URL}`);
  console.log(`[sap-middleware] timeouts request=${TIMEOUT_MS}ms headers=${HEADERS_TIMEOUT_MS}ms body=${BODY_TIMEOUT_MS}ms keepAlive=${CONNECT_TIMEOUT_MS}ms`);
});

server.headersTimeout   = HEADERS_TIMEOUT_MS;
server.requestTimeout   = BODY_TIMEOUT_MS;
server.keepAliveTimeout = CONNECT_TIMEOUT_MS;
