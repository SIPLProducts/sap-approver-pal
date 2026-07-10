/**
 * Public server function invoked from the login form "Forgot Password" flow.
 * Calls the SAP API named "Forgot_API" (configured in SAP API Settings) with
 * payload { FORGOT: { EMAIL } } and returns ok/status only.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type SapForgotResult = {
  ok: boolean;
  status: number;
  error?: string;
};

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

function sapSucceeded(body: unknown): boolean {
  const records = collectObjects(body);
  if (records.some((r) => r.ok === true || r.success === true)) return true;
  return records.some((record) => {
    const values = Object.entries(record).map(
      ([k, v]) => [k.toLowerCase(), stringValue(v).trim().toLowerCase()] as const,
    );
    const status = values.find(([k]) => /^(status|code|returncode|responsecode|type|result)$/.test(k))?.[1];
    const message = values.find(([k]) => /^(message|msg|text|description|remarks|returnmessage)$/.test(k))?.[1] ?? "";
    if (["s", "success", "successful", "ok", "true", "200"].includes(status ?? "")) return true;
    if (message && /\b(sent|success|email|reset|dispatched)\b/i.test(message)) return true;
    return false;
  });
}

function sapRejected(body: unknown): boolean {
  return collectObjects(body).some((record) => {
    if (record.ok === false || record.success === false) return true;
    const text = Object.entries(record)
      .filter(([k]) => /^(error|message|msg|text|description|remarks|returnmessage|status|code|type|result)$/i.test(k))
      .map(([, v]) => stringValue(v).trim().toLowerCase())
      .filter(Boolean)
      .join(" ");
    return /\b(fail|failed|failure|invalid|denied|reject|rejected|unauthorized|forbidden|locked|incorrect|wrong|not found|not successful)\b/i.test(text);
  });
}

function errorFromBody(body: unknown, fallback: string): string {
  const record = asRecord(body);
  if (typeof record?.error === "string") return record.error;
  const nested = record?.data;
  const nr = asRecord(nested);
  if (typeof nr?.error === "string") return nr.error;
  if (typeof nr?.message === "string") return nr.message;
  if (typeof record?.message === "string") return record.message;
  if (typeof nested === "string" && nested.trim()) return nested.slice(0, 200);
  if (typeof body === "string" && body.trim()) return body.slice(0, 200);
  if (body != null) return JSON.stringify(body).slice(0, 200);
  return fallback;
}

export const sapForgot = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ email: z.string().trim().email().max(200) }).parse(d),
  )
  .handler(async ({ data }): Promise<SapForgotResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cfg } = await supabaseAdmin
      .from("sap_api_configs")
      .select("*")
      .eq("name", "Forgot_API")
      .eq("is_active", true)
      .maybeSingle();

    if (!cfg) {
      return {
        ok: false,
        status: 0,
        error: "Forgot_API is not configured in SAP API Settings",
      };
    }

    // Load No-Reply sender settings to use as the "from" for the SAP-triggered mail.
    const { data: noReply } = await supabaseAdmin
      .from("email_no_reply_config")
      .select("enabled, from_email, from_name")
      .eq("id", "default")
      .maybeSingle();

    if (!noReply?.enabled || !noReply.from_email) {
      return {
        ok: false,
        status: 0,
        error: "No-Reply sender is not configured. Set it in Email Configuration.",
      };
    }

    const payload = {
      FORGOT: {
        EMAIL: data.email,
        FROM_EMAIL: noReply.from_email,
        FROM_NAME: noReply.from_name ?? "",
      },
    };
    const t0 = Date.now();
    let ok = false;
    let status = 0;
    let message = "";
    let error: string | undefined;
    let path = "direct";

    try {
      const [{ data: g }, { data: gs }] = await Promise.all([
        supabaseAdmin
          .from("sap_global_settings")
          .select("middleware_url, sap_base_url, sap_username")
          .eq("id", "default")
          .maybeSingle(),
        supabaseAdmin
          .from("sap_global_secrets")
          .select("proxy_secret, sap_password")
          .eq("id", "default")
          .maybeSingle(),
      ]);

      if (g?.middleware_url) {
        path = "middleware";
        const url = `${g.middleware_url.replace(/\/$/, "")}/login/Forgot_API`;
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
        ok = res.ok && sapSucceeded(body) && !sapRejected(body);
        status = statusValue(bodyRecord?.status) ?? res.status;
        message = `${status}`;
        if (!ok) {
          if (res.status === 401) {
            error = "Middleware rejected the shared secret. Check the proxy secret configuration.";
          } else if (res.status === 404) {
            error = "Middleware forgot route was not found. Restart or redeploy the Node middleware.";
          } else {
            error = errorFromBody(body, `Password reset failed (${status})`);
          }
        }
      } else {
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
        const rawText = await res.text().catch(() => "");
        const body = parseResponseBody(rawText);
        const bodyRecord = asRecord(body);
        ok = res.ok && sapSucceeded(body) && !sapRejected(body);
        status = statusValue(bodyRecord?.status) ?? res.status;
        message = `${res.status} ${res.statusText}`;
        if (!ok) {
          error = errorFromBody(body, `Password reset failed (${res.status})`);
        }
      }
    } catch (e) {
      ok = false;
      message = (e as Error).message;
      error = message;
    }

    await supabaseAdmin.from("sap_api_sync_log").insert({
      config_id: cfg.id,
      status: ok ? "ok" : "error",
      latency_ms: Date.now() - t0,
      message: `forgot ${path}: ${message}`,
    });

    return { ok, status, error };
  });
