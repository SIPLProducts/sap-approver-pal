import type { ResolvedConfig } from "./config-loader.js";
import { buildRequestPayload, mapResponse } from "./field-mapping.js";
import { logger } from "./lib/logger.js";

const oauthTokenCache = new Map<string, { token: string; expiresAt: number }>();

async function buildAuthHeaders(cfg: ResolvedConfig): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (cfg.auth_type === "basic" && cfg.credentials.username && cfg.credentials.password) {
    const token = Buffer.from(`${cfg.credentials.username}:${cfg.credentials.password}`).toString("base64");
    headers.Authorization = `Basic ${token}`;
  } else if (cfg.auth_type === "oauth") {
    const token = await getOauthToken(cfg);
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function getOauthToken(cfg: ResolvedConfig): Promise<string | null> {
  const cached = oauthTokenCache.get(cfg.id);
  if (cached && cached.expiresAt > Date.now() + 5_000) return cached.token;

  const tokenUrl = cfg.credentials.extra_headers["oauth_token_url"];
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
  });
  if (!res.ok) {
    logger.error({ status: res.status }, "OAuth token fetch failed");
    return null;
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;
  oauthTokenCache.set(cfg.id, {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  });
  return json.access_token;
}

export async function invokeSap(cfg: ResolvedConfig, inputs: Record<string, unknown>) {
  const payload = buildRequestPayload(cfg.requestFields, inputs);

  const url = new URL(cfg.endpoint_url);
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...cfg.credentials.extra_headers,
    ...(await buildAuthHeaders(cfg)),
  };

  let body: string | undefined;
  if (cfg.http_method === "GET" || cfg.http_method === "DELETE" || cfg.http_method === "HEAD") {
    for (const [k, v] of Object.entries(payload)) {
      if (v != null) url.searchParams.set(k, String(v));
    }
  } else {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
    body = JSON.stringify(payload);
  }

  const t0 = Date.now();
  const res = await fetch(url.toString(), { method: cfg.http_method, headers, body });
  const latency_ms = Date.now() - t0;

  const contentType = res.headers.get("content-type") ?? "";
  const raw = contentType.includes("application/json")
    ? await res.json().catch(() => null)
    : await res.text().catch(() => "");

  const data = mapResponse(cfg.responseFields, raw);
  return { ok: res.ok, status: res.status, latency_ms, data };
}

export async function probeSap(cfg: ResolvedConfig) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...cfg.credentials.extra_headers,
    ...(await buildAuthHeaders(cfg)),
  };
  const t0 = Date.now();
  try {
    const res = await fetch(cfg.endpoint_url, { method: "HEAD", headers });
    return { ok: res.ok, status: res.status, latency_ms: Date.now() - t0, message: `${res.status} ${res.statusText}` };
  } catch (e) {
    return { ok: false, status: 0, latency_ms: Date.now() - t0, message: (e as Error).message };
  }
}
