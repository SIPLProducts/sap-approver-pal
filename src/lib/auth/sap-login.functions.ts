/**
 * Public server function invoked from the login form.
 * Calls the SAP API named "Login_API" (configured in SAP API Settings) with
 * payload { LOGIN: { USER, PASSWORD } } and returns ok/status only.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function parseResponseBody(text: string): unknown {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function statusValue(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function collectObjects(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 4) return [];
  if (Array.isArray(value)) return value.flatMap((item) => collectObjects(item, depth + 1));
  const record = asRecord(value);
  if (!record) return [];
  return [record, ...Object.values(record).flatMap((item) => collectObjects(item, depth + 1))];
}

function sapLoginSucceeded(body: unknown): boolean {
  const records = collectObjects(body);
  if (records.some((record) => record.ok === true || record.success === true)) return true;

  return records.some((record) => {
    const values = Object.entries(record).map(([key, value]) => [key.toLowerCase(), stringValue(value).trim().toLowerCase()] as const);
    const status = values.find(([key]) => /^(status|code|returncode|responsecode|type|result)$/.test(key))?.[1];
    const message = values.find(([key]) => /^(message|msg|text|description|remarks|returnmessage)$/.test(key))?.[1] ?? "";

    if (["s", "success", "successful", "ok", "true", "1", "200"].includes(status ?? "")) return true;
    if (message && /\b(success|successful|valid|authenticated|welcome|logged in|login ok)\b/i.test(message)) return true;
    return false;
  });
}

function sapLoginRejected(body: unknown): boolean {
  return collectObjects(body).some((record) => {
    if (record.ok === false || record.success === false) return true;
    const text = Object.entries(record)
      .filter(([key]) => /^(error|message|msg|text|description|remarks|returnmessage|status|code|type|result)$/i.test(key))
      .map(([, value]) => stringValue(value).trim().toLowerCase())
      .filter(Boolean)
      .join(" ");
    return /\b(fail|failed|failure|invalid|denied|reject|rejected|unauthorized|forbidden|locked|incorrect|wrong|not successful)\b/i.test(text);
  });
}

function loginErrorFromBody(body: unknown, fallback: string): string {
  const record = asRecord(body);
  if (typeof record?.error === "string") return record.error;
  const nested = record?.data;
  const nestedRecord = asRecord(nested);
  if (typeof nestedRecord?.error === "string") return nestedRecord.error;
  if (typeof nestedRecord?.message === "string") return nestedRecord.message;
  if (typeof nested === "string" && nested.trim()) return nested.slice(0, 200);
  if (typeof body === "string" && body.trim()) return body.slice(0, 200);
  if (body != null) return JSON.stringify(body).slice(0, 200);
  return fallback;
}

export const sapLogin = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        username: z.string().min(1).max(200),
        password: z.string().min(1).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cfg } = await supabaseAdmin
      .from("sap_api_configs")
      .select("*")
      .eq("name", "Login_API")
      .eq("is_active", true)
      .maybeSingle();

    if (!cfg) {
      return {
        ok: false,
        status: 0,
        error: "Login_API is not configured in SAP API Settings",
      };
    }

    const payload = { LOGIN: { USER: data.username, PASSWORD: data.password } };
    const t0 = Date.now();
    let ok = false;
    let status = 0;
    let message = "";
    let error: string | undefined;

    try {
      if (cfg.auth_type === "proxy") {
        const [{ data: g }, { data: gs }] = await Promise.all([
          supabaseAdmin.from("sap_global_settings").select("middleware_url").eq("id", "default").maybeSingle(),
          supabaseAdmin.from("sap_global_secrets").select("proxy_secret").eq("id", "default").maybeSingle(),
        ]);
        if (!g?.middleware_url) {
          return { ok: false, status: 0, error: "Middleware URL is not configured in SAP API Settings." };
        }
        const url = `${g.middleware_url.replace(/\/$/, "")}/login/Login_API`;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (gs?.proxy_secret) headers["x-shared-secret"] = gs.proxy_secret;
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ inputs: payload }),
        });
        const rawText = await res.text().catch(() => "");
        const body = parseResponseBody(rawText);
        const bodyRecord = asRecord(body);
        ok = (res.ok && !sapLoginRejected(body)) || sapLoginSucceeded(body);
        status = statusValue(bodyRecord?.status) ?? res.status;
        message = `${status}`;
        if (!ok) {
          if (res.status === 401) {
            error = "Middleware rejected the shared secret. Check the proxy secret configuration.";
          } else if (res.status === 404) {
            error = "Middleware login route was not found. Restart or redeploy the Node middleware.";
          } else if (res.status === 403) {
            error = loginErrorFromBody(body, "SAP rejected the login request (403).");
          } else {
            error = loginErrorFromBody(body, `Login failed (${status})`);
          }
        }
      } else {
        const { data: g } = await supabaseAdmin
          .from("sap_global_settings")
          .select("sap_base_url, sap_username")
          .eq("id", "default")
          .maybeSingle();
        const { data: gs } = await supabaseAdmin
          .from("sap_global_secrets")
          .select("sap_password")
          .eq("id", "default")
          .maybeSingle();
        const { data: creds } = await supabaseAdmin
          .from("sap_api_credentials")
          .select("extra_headers")
          .eq("config_id", cfg.id)
          .maybeSingle();

        const { resolveSapUrl } = await import("@/lib/sap/url");
        const target = resolveSapUrl(cfg.endpoint_url, g?.sap_base_url ?? null);
        const headers: Record<string, string> = {
          Accept: "application/json",
          "Content-Type": "application/json",
        };
        if (cfg.auth_type === "basic" && g?.sap_username && gs?.sap_password) {
          headers.Authorization =
            "Basic " + Buffer.from(`${g.sap_username}:${gs.sap_password}`).toString("base64");
        }
        for (const [k, v] of Object.entries(
          (creds?.extra_headers ?? {}) as Record<string, string>,
        )) {
          headers[k] = v;
        }

        const method = (cfg.http_method ?? "POST").toUpperCase();
        const res = await fetch(target, {
          method,
          headers,
          body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(payload),
        });
        status = res.status;
        ok = res.ok;
        message = `${res.status} ${res.statusText}`;
        if (!ok) {
          const text = await res.text().catch(() => "");
          error = `Login failed (${res.status})${text ? `: ${text.slice(0, 200)}` : ""}`;
        }
      }
    } catch (e) {
      message = (e as Error).message;
      error = message;
    }

    await supabaseAdmin.from("sap_api_sync_log").insert({
      config_id: cfg.id,
      status: ok ? "ok" : "error",
      latency_ms: Date.now() - t0,
      message: `login: ${message}`,
    });

    return { ok, status, error };
  });
