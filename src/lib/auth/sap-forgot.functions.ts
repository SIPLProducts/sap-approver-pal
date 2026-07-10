/**
 * Public server function invoked from the login form "Forgot Password" flow.
 * Calls the SAP API named "Forgot_API" (configured in SAP API Settings) with
 * payload { FORGOT: { EMAIL } }, extracts ZMAIL/ZUSER/ZPASSWORD/ZSTATUS from
 * the response, then emails the credentials to ZMAIL using the No-Reply SMTP
 * configuration saved in the Email Configuration screen.
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
  if (depth > 6) return [];
  if (Array.isArray(value)) return value.flatMap((item) => collectObjects(item, depth + 1));
  const record = asRecord(value);
  if (!record) return [];
  return [record, ...Object.values(record).flatMap((item) => collectObjects(item, depth + 1))];
}

function findFieldValue(body: unknown, keys: string[]): string {
  const wanted = new Set(keys.map((k) => k.toLowerCase()));
  for (const record of collectObjects(body)) {
    for (const [k, v] of Object.entries(record)) {
      if (wanted.has(k.toLowerCase())) {
        const s = stringValue(v).trim();
        if (s) return s;
      }
    }
  }
  return "";
}

function sapSucceeded(body: unknown): boolean {
  const records = collectObjects(body);
  if (records.some((r) => r.ok === true || r.success === true)) return true;
  return records.some((record) => {
    const values = Object.entries(record).map(
      ([k, v]) => [k.toLowerCase(), stringValue(v).trim().toLowerCase()] as const,
    );
    const status = values.find(([k]) => /^(status|code|returncode|responsecode|type|result|zstatus)$/.test(k))?.[1];
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

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${"*".repeat(Math.max(1, local.length - head.length))}@${domain}`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildCredentialsEmail(fields: {
  zuser: string;
  zpassword: string;
  zstatus: string;
}): { html: string; text: string } {
  const user = escapeHtml(fields.zuser);
  const pwd = escapeHtml(fields.zpassword);
  const status = escapeHtml(fields.zstatus || "Password Reset");
  const greetingName = /^[A-Za-z][A-Za-z .'-]{1,60}$/.test(fields.zuser) ? fields.zuser : "";
  const greeting = greetingName ? `Hello ${escapeHtml(greetingName)},` : "Hello,";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:linear-gradient(135deg,#0b1f3a 0%,#173a6b 100%);padding:26px 32px;color:#ffffff;">
                <div style="font-size:12px;letter-spacing:0.22em;text-transform:uppercase;opacity:0.75;">Re Sustainability</div>
                <div style="font-size:22px;font-weight:700;margin-top:6px;">Approvals — Password Reset</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 8px 32px;">
                <p style="margin:0 0 12px 0;font-size:15px;">${greeting}</p>
                <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#374151;">
                  You requested a password reset for your Re Sustainability Approvals account. Please find your updated credentials below.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;">
                  <tr>
                    <td style="padding:16px 18px;border-bottom:1px solid #eef2f7;">
                      <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">User ID</div>
                      <div style="font-size:15px;font-weight:600;margin-top:4px;color:#111827;">${user}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:16px 18px;border-bottom:1px solid #eef2f7;">
                      <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">Temporary Password</div>
                      <div style="margin-top:6px;display:inline-block;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:15px;font-weight:600;color:#0b1f3a;background:#ffffff;border:1px dashed #cbd5e1;border-radius:6px;padding:8px 12px;letter-spacing:0.04em;">${pwd}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:16px 18px;">
                      <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">Status</div>
                      <div style="font-size:14px;font-weight:600;margin-top:4px;color:#047857;">${status}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 32px 4px 32px;">
                <div style="background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:8px;padding:12px 14px;font-size:13px;line-height:1.55;">
                  <strong>Security notice:</strong> For your safety, please sign in and change this password immediately. Do not share it with anyone.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 28px 32px;">
                <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.55;">
                  This is an automated message from Re Sustainability Approvals. Please do not reply to this email.
                </p>
              </td>
            </tr>
          </table>
          <div style="max-width:600px;width:100%;margin-top:14px;font-size:11px;color:#94a3b8;text-align:center;">
            © ${new Date().getFullYear()} Re Sustainability Limited
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    greeting,
    "",
    "You requested a password reset for your Re Sustainability Approvals account.",
    "Please find your updated credentials below.",
    "",
    `User ID:  ${fields.zuser}`,
    `Password: ${fields.zpassword}`,
    `Status:   ${fields.zstatus || "Password Reset"}`,
    "",
    "For your security, please sign in and change this password immediately. Do not share it with anyone.",
    "",
    "— Re Sustainability Approvals (automated message, do not reply)",
  ].join("\n");

  return { html, text };
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

    const [{ data: noReply }, { data: noReplySecret }] = await Promise.all([
      supabaseAdmin
        .from("email_no_reply_config")
        .select("enabled, host, port, encryption, username, from_email, from_name, cc_recipients")
        .eq("id", "default")
        .maybeSingle(),
      supabaseAdmin
        .from("email_no_reply_secrets")
        .select("app_password")
        .eq("id", "default")
        .maybeSingle(),
    ]);

    if (!noReply?.enabled || !noReply.host || !noReply.port || !noReply.from_email || !noReplySecret?.app_password) {
      return {
        ok: false,
        status: 0,
        error: "No-Reply SMTP is not fully configured. Set host, port, from email, and app password in Email Configuration.",
      };
    }

    const payload = { zmail: data.email };
    const t0 = Date.now();
    let ok = false;
    let status = 0;
    let message = "";
    let error: string | undefined;
    let path = "direct";
    let responseBody: unknown = null;
    let httpOk = false;

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
        responseBody = parseResponseBody(rawText);
        const bodyRecord = asRecord(responseBody);
        httpOk = res.ok;
        status = statusValue(bodyRecord?.status) ?? res.status;
        message = `${status}`;
        if (!httpOk) {
          if (res.status === 401) {
            error = "Middleware rejected the shared secret. Check the proxy secret configuration.";
          } else if (res.status === 404) {
            error = "Middleware forgot route was not found. Restart or redeploy the Node middleware.";
          } else {
            error = errorFromBody(responseBody, `Password reset failed (${status})`);
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
        responseBody = parseResponseBody(rawText);
        const bodyRecord = asRecord(responseBody);
        httpOk = res.ok;
        status = statusValue(bodyRecord?.status) ?? res.status;
        message = `${res.status} ${res.statusText}`;
        if (!httpOk) {
          error = errorFromBody(responseBody, `Password reset failed (${res.status})`);
        }
      }
    } catch (e) {
      ok = false;
      message = (e as Error).message;
      error = message;
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms: Date.now() - t0,
        message: `forgot ${path}: ${message}`,
      });
      return { ok: false, status, error };
    }

    // Extract credential fields from response
    const zmail = findFieldValue(responseBody, ["ZMAIL", "ZEMAIL", "MAIL", "EMAIL"]);
    const zuser = findFieldValue(responseBody, ["ZUSER", "USER", "USERNAME", "USERID"]);
    const zpassword = findFieldValue(responseBody, ["ZPASSWORD", "PASSWORD", "PWD", "ZPWD"]);
    const zstatus = findFieldValue(responseBody, ["ZSTATUS", "STATUS"]);

    const sapOk = httpOk && !sapRejected(responseBody) && (sapSucceeded(responseBody) || Boolean(zuser && zpassword));

    if (!sapOk) {
      const finalError = error ?? errorFromBody(responseBody, `Password reset failed (${status})`);
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms: Date.now() - t0,
        message: `forgot ${path}: ${message}`,
      });
      return { ok: false, status, error: finalError };
    }

    if (!zmail || !zuser || !zpassword) {
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms: Date.now() - t0,
        message: `forgot ${path}: ${message}; missing credential fields`,
      });
      return {
        ok: false,
        status,
        error: "SAP did not return credentials for this email. Please contact your administrator.",
      };
    }

    // Send the credentials email via No-Reply SMTP
    try {
      const nodemailer = (await import("nodemailer")).default;
      const enc = (noReply.encryption ?? "tls") as string;
      const transport = nodemailer.createTransport({
        host: noReply.host,
        port: noReply.port,
        secure: enc === "ssl",
        requireTLS: enc === "starttls" || enc === "tls",
        auth: noReply.username
          ? { user: noReply.username, pass: noReplySecret.app_password }
          : undefined,
      });

      const { html, text } = buildCredentialsEmail({ zuser, zpassword, zstatus });
      await transport.sendMail({
        from: noReply.from_name
          ? `${noReply.from_name} <${noReply.from_email}>`
          : noReply.from_email,
        to: zmail,
        cc: (noReply.cc_recipients ?? []) as string[],
        subject: "Your Re Sustainability Approvals credentials",
        html,
        text,
      });

      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "ok",
        latency_ms: Date.now() - t0,
        message: `forgot ${path}: ${message}; mail sent to ${maskEmail(zmail)}`,
      });
      return { ok: true, status };
    } catch (mailErr) {
      const mailMessage = (mailErr as Error).message ?? "SMTP send failed";
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms: Date.now() - t0,
        message: `forgot ${path}: ${message}; mail error: ${mailMessage}`,
      });
      return {
        ok: false,
        status,
        error: "Reset succeeded in SAP but the credentials email could not be sent. Please contact your administrator.",
      };
    }
  });
