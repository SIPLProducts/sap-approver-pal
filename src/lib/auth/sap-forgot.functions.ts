/**
 * Public server function invoked from the login form "Forgot Password" flow.
 * Calls the SAP API named "Forgot_API" (configured in SAP API Settings) with
 * payload { zmail }, extracts fields like ZUSER/ZPASSWORD/ZSTATUS from the
 * response, then emails the credentials to the entered email address using the
 * No-Reply SMTP configuration and configured CC recipients.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import reLogo from "@/assets/re-logo.png.asset.json";

type LogoAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
  cid: string;
};

async function fetchLogoAttachment(): Promise<LogoAttachment | null> {
  try {
    const url = `https://sap-approver-pal.lovable.app${reLogo.url}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const content = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/png";
    return { filename: "re-logo.png", content, contentType, cid: "re-logo" };
  } catch {
    return null;
  }
}

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

type EmailField = { key: string; label: string; value: string };

function prettifyLabel(key: string): string {
  const stripped = key.replace(/^z_?/i, "");
  return stripped
    .replace(/[_\-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function pickFirstRecord(value: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 6 || value == null) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const rec = pickFirstRecord(item, depth + 1);
      if (rec) return rec;
    }
    return null;
  }
  return asRecord(value);
}

function extractFields(record: Record<string, unknown>): EmailField[] {
  const out: EmailField[] = [];
  for (const [key, raw] of Object.entries(record)) {
    if (raw == null) continue;
    if (typeof raw === "object") continue;
    const value = stringValue(raw).trim();
    if (!value) continue;
    out.push({ key, label: prettifyLabel(key), value });
  }
  return out;
}

function renderValueSpans(value: string): string {
  return Array.from(value)
    .map(
      (ch, index) =>
        `<span style="display:inline-block;min-width:0;" data-pos="${index}">${escapeHtml(ch)}</span>`,
    )
    .join("");
}

function buildCredentialsEmail(args: {
  fields: EmailField[];
  recipient: string;
}): { html: string; text: string } {
  const { fields, recipient } = args;
  const headline = fields[0]?.value || recipient;
  const headlineHtml = escapeHtml(headline);

  const rowsHtml = fields
    .map(
      (f) => `
                  <tr>
                    <td style="padding:10px 0;font-size:13px;color:#6b7280;width:150px;vertical-align:top;">${escapeHtml(f.label)}</td>
                    <td style="padding:10px 0;">
                      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                        <tr>
                          <td translate="no" dir="ltr" aria-label="${escapeHtml(f.label)}" style="font-size:14px;color:#111827;font-weight:600;letter-spacing:0;line-height:1.5;mso-line-height-rule:exactly;user-select:all;-webkit-user-select:all;white-space:nowrap;">${renderValueSpans(f.value)}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.06);">
            <tr>
              <td style="padding:28px 32px 20px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;padding-right:14px;">
                      <img src="${LOGO_URL}" width="52" height="52" alt="Re Sustainability" style="display:block;border:0;outline:none;text-decoration:none;" />
                    </td>
                    <td style="vertical-align:middle;">
                      <div style="font-size:22px;font-weight:800;color:#d4202a;line-height:1.1;">Re Sustainability</div>
                      <div style="margin-top:4px;font-size:12px;color:#6b7280;border-bottom:3px solid #f5c518;display:inline-block;padding-bottom:2px;">RESL Approvals</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px;">
                <div style="height:1px;background:#eef2f7;"></div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 0 32px;">
                <div style="background:#f3f4f6;border-radius:10px;padding:16px 18px;">
                  <div style="font-size:16px;font-weight:700;color:#111827;">${headlineHtml}</div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 8px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 26px 32px;">
                <div style="border-top:1px solid #eef2f7;padding-top:14px;font-size:12px;color:#9ca3af;text-align:center;">
                  Please sign in and change your password immediately after login.
                </div>
              </td>
            </tr>
          </table>
          <div style="max-width:520px;width:100%;margin-top:14px;font-size:11px;color:#9ca3af;text-align:center;">
            © ${new Date().getFullYear()} Re Sustainability Limited
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const labelWidth = Math.max(0, ...fields.map((f) => f.label.length));
  const text = [
    ...fields.map((f) => `${f.label.padEnd(labelWidth)} : ${f.value}`),
    "",
    "Please sign in and change your password immediately after login.",
    "",
    "— RESL Approvals",
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

    // Extract fields dynamically from the SAP response. Middleware wraps SAP
    // output as { ok, status, latency_ms, data: <SAP body> } and SAP returns
    // an array like [{ ZUSER, ZPASSWORD, ZSTATUS }]. We render whatever keys
    // SAP sends — no hardcoded field list.
    const envelope = asRecord(responseBody);
    const inner = envelope && "data" in envelope ? envelope.data : responseBody;
    const record = pickFirstRecord(inner) ?? pickFirstRecord(responseBody) ?? {};
    const fields = extractFields(record);
    const nonEmailFields = fields.filter((f) => !/mail|email/i.test(f.key));
    // Always send recovery credentials to the email address typed by the user.
    // SAP response fields are intentionally not used for recipient routing.
    const recipientEmail = data.email;

    const fieldSummary = fields
      .map((f) => (/(password|pwd|secret)/i.test(f.key) ? `${f.key}.len=${f.value.length}` : f.key))
      .join(",");
    console.log(`[sap-forgot] fields=${fieldSummary || "<none>"}`);

    const sapOk =
      httpOk && !sapRejected(responseBody) && (sapSucceeded(responseBody) || nonEmailFields.length > 0);

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

    if (nonEmailFields.length === 0) {
      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "error",
        latency_ms: Date.now() - t0,
        message: `forgot ${path}: ${message}; empty response fields`,
      });
      return {
        ok: false,
        status,
        error: "SAP did not return any account details for this email.",
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

      const ccRecipients = ((noReply.cc_recipients ?? []) as string[]).filter(Boolean);
      const recipientFromInfo = (value: unknown): string => {
        if (typeof value === "string") return value;
        const record = asRecord(value);
        if (typeof record?.address === "string") return record.address;
        return value == null ? "" : String(value);
      };
      const { html, text } = buildCredentialsEmail({ fields, recipient: recipientEmail });
      const info = await transport.sendMail({
        from: noReply.from_name
          ? `${noReply.from_name} <${noReply.from_email}>`
          : noReply.from_email,
        to: recipientEmail,
        cc: ccRecipients,
        subject: "Account Recovery Successful: RESL APPROVALS Login Information",

        html,
        text,
      });

      const mailInfo = info as {
        messageId?: string;
        accepted?: unknown[];
        rejected?: unknown[];
        pending?: unknown[];
      };
      const accepted = Array.isArray(mailInfo.accepted)
        ? mailInfo.accepted.map(recipientFromInfo).filter(Boolean)
        : [];
      const rejected = Array.isArray(mailInfo.rejected)
        ? mailInfo.rejected.map(recipientFromInfo).filter(Boolean)
        : [];
      const pending = Array.isArray(mailInfo.pending)
        ? mailInfo.pending.map(recipientFromInfo).filter(Boolean)
        : [];
      const recipientWasRejected = rejected.some(
        (email) => email.toLowerCase() === recipientEmail.toLowerCase(),
      );
      const deliverySummary = [
        `mail sent to ${maskEmail(recipientEmail)}`,
        ccRecipients.length ? `cc ${ccRecipients.map(maskEmail).join(",")}` : "cc none",
        mailInfo.messageId ? `messageId ${mailInfo.messageId}` : "messageId unavailable",
        accepted.length ? `accepted ${accepted.map(maskEmail).join(",")}` : "accepted unavailable",
        rejected.length ? `rejected ${rejected.map(maskEmail).join(",")}` : "rejected none",
        pending.length ? `pending ${pending.map(maskEmail).join(",")}` : "pending none",
      ].join("; ");

      if (recipientWasRejected) {
        await supabaseAdmin.from("sap_api_sync_log").insert({
          config_id: cfg.id,
          status: "error",
          latency_ms: Date.now() - t0,
          message: `forgot ${path}: ${message}; ${deliverySummary}`,
        });
        return {
          ok: false,
          status,
          error: "SMTP rejected the entered recipient email address. Please verify the email address and No-Reply SMTP configuration.",
        };
      }

      await supabaseAdmin.from("sap_api_sync_log").insert({
        config_id: cfg.id,
        status: "ok",
        latency_ms: Date.now() - t0,
        message: `forgot ${path}: ${message}; ${deliverySummary}`,
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
