// SAP Middleware — single-file Node.js (Express) service.
// Sits between the React/TanStack frontend and SAP. Reads dynamic API
// configurations from Lovable Cloud (Supabase) and forwards calls to SAP.
//
// Routes:
//   GET  /__health      — public liveness probe
//   POST /sap/test      — probes a configured SAP endpoint (auth: x-shared-secret)
//   POST /sap/invoke    — runs a configured SAP API call      (auth: x-shared-secret)

import "dotenv/config";
import express from "express";
import cors from "cors";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

// ---------- env ----------
const PORT = parseInt(process.env.PORT || "3002", 10);

// Shared secret — MUST match "Proxy Secret / Password" in
// SAP API Settings → Middleware Configuration tab.
// Accepts MIDDLEWARE_SHARED_SECRET (preferred) or legacy SHARED_SECRET.
const SHARED_SECRET =
  process.env.MIDDLEWARE_SHARED_SECRET || process.env.SHARED_SECRET || "123456";

// Lovable Cloud (Supabase) — required to load dynamic SAP API configs.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Timeouts.
const TIMEOUT_MS         = parseInt(process.env.SAP_REQUEST_TIMEOUT_MS || "30000", 10);
const CONNECT_TIMEOUT_MS = parseInt(process.env.SAP_CONNECT_TIMEOUT_MS || "60000", 10);
const HEADERS_TIMEOUT_MS = parseInt(process.env.SAP_HEADERS_TIMEOUT_MS || "60000", 10);
const BODY_TIMEOUT_MS    = parseInt(process.env.SAP_BODY_TIMEOUT_MS    || "60000", 10);

// Optional last-resort fallbacks. Per-row values in SAP API Settings
// always win; these only fill in when a config row has no URL/credentials
// (useful for local smoke tests).
const FALLBACK_BP_URL      = process.env.SAP_BP_API_URL  || "";
const FALLBACK_DMS_URL     = process.env.SAP_DMS_API_URL || FALLBACK_BP_URL;
const FALLBACK_BP_USERNAME = process.env.SAP_BP_USERNAME || "";
const FALLBACK_BP_PASSWORD = process.env.SAP_BP_PASSWORD || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "[fatal] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. Copy .env.example to .env and fill them in.",
  );
  process.exit(1);
}
if (!SHARED_SECRET) {
  console.warn("[warn] MIDDLEWARE_SHARED_SECRET is empty — protected routes will reject every request.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------- shared-secret auth ----------
function requireSharedSecret(req, res, next) {
  if (!SHARED_SECRET) {
    return res.status(500).json({ ok: false, error: "Middleware misconfigured: shared secret not set" });
  }
  const got = req.header("x-shared-secret");
  if (!got || got !== SHARED_SECRET) {
    return res.status(401).json({ ok: false, error: "Invalid or missing x-shared-secret" });
  }
  next();
}

// ---------- config loader (30s cache, invalidates on updated_at) ----------
const TTL_MS = 30_000;
const configCache = new Map();

async function loadConfig(configId) {
  const cached = configCache.get(configId);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.cfg;

  const { data: cfg, error } = await supabase
    .from("sap_api_configs")
    .select("*")
    .eq("id", configId)
    .maybeSingle();
  if (error) throw new Error(`Load config failed: ${error.message}`);
  if (!cfg) throw new Error(`Config not found: ${configId}`);
  if (!cfg.is_active) throw new Error(`Config is inactive: ${configId}`);

  const [{ data: creds }, { data: reqFields }, { data: resFields }] = await Promise.all([
    supabase.from("sap_api_credentials").select("*").eq("config_id", configId).maybeSingle(),
    supabase.from("sap_api_request_fields").select("*").eq("config_id", configId).order("sort_order"),
    supabase.from("sap_api_response_fields").select("*").eq("config_id", configId).order("sort_order"),
  ]);

  // Pick a fallback URL based on module — only used when row lacks one.
  const moduleFallback =
    cfg.module === "MM" ? FALLBACK_DMS_URL : FALLBACK_BP_URL;

  const resolved = {
    id: cfg.id,
    name: cfg.name,
    module: cfg.module,
    endpoint_url: cfg.endpoint_url || moduleFallback,
    http_method: cfg.http_method,
    auth_type: cfg.auth_type,
    is_active: cfg.is_active,
    updated_at: cfg.updated_at,
    credentials: {
      username: creds?.username ?? FALLBACK_BP_USERNAME ?? null,
      password: creds?.password_encrypted ?? FALLBACK_BP_PASSWORD ?? null,
      extra_headers: creds?.extra_headers ?? {},
    },
    requestFields: reqFields ?? [],
    responseFields: resFields ?? [],
  };

  if (!resolved.endpoint_url) {
    throw new Error(`Config ${configId} has no endpoint_url and no fallback env URL is set`);
  }

  configCache.set(configId, { at: Date.now(), updated_at: cfg.updated_at, cfg: resolved });
  return resolved;
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

// Health
app.get("/__health", (_req, res) => {
  res.json({ ok: true, service: "sap-middleware", time: new Date().toISOString() });
});

// Test connection
const TestBody = z.object({ configId: z.string().uuid() });
app.post("/sap/test", requireSharedSecret, async (req, res) => {
  const parsed = TestBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.message });

  try {
    const cfg = await loadConfig(parsed.data.configId);
    const result = await probeSap(cfg);
    await supabase.from("sap_api_sync_log").insert({
      config_id: parsed.data.configId,
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

    await supabase.from("sap_api_sync_log").insert({
      config_id: configId,
      status: result.ok ? "ok" : "error",
      latency_ms: result.latency_ms,
      message: `invoke: ${result.status}`,
    });

    return res.status(result.ok ? 200 : 502).json(result);
  } catch (e) {
    console.error("[invoke] failed", e.message);
    await supabase.from("sap_api_sync_log").insert({
      config_id: configId,
      status: "error",
      latency_ms: 0,
      message: `invoke: ${e.message}`.slice(0, 500),
    });
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error("[unhandled]", err.message);
  res.status(500).json({ ok: false, error: err.message });
});

const server = app.listen(PORT, () => {
  console.log(`[sap-middleware] listening on :${PORT}`);
  console.log(`[sap-middleware] timeouts request=${TIMEOUT_MS}ms headers=${HEADERS_TIMEOUT_MS}ms body=${BODY_TIMEOUT_MS}ms keepAlive=${CONNECT_TIMEOUT_MS}ms`);
});

// HTTP server-level timeouts.
server.headersTimeout   = HEADERS_TIMEOUT_MS;
server.requestTimeout   = BODY_TIMEOUT_MS;
server.keepAliveTimeout = CONNECT_TIMEOUT_MS;
