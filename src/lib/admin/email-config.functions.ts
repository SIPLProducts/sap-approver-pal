/**
 * No-Reply email configuration server functions.
 * - getNoReplyEmailConfig: load config for the admin screen (no password).
 * - saveNoReplyEmailConfig: upsert config + password (empty password preserves existing).
 * - sendNoReplyTestEmail: send a test email using the saved SMTP settings.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const encryptionSchema = z.enum(["none", "ssl", "tls", "starttls"]);

const configSchema = z.object({
  enabled: z.boolean(),
  host: z.string().trim().max(200).nullable().optional().default(null),
  port: z.number().int().min(1).max(65535).nullable().optional().default(null),
  encryption: encryptionSchema.default("tls"),
  username: z.string().trim().max(200).nullable().optional().default(null),
  from_email: z.string().trim().email().max(200).nullable().or(z.literal("")).optional(),
  from_name: z.string().trim().max(200).nullable().optional().default(null),
  cc_recipients: z.array(z.string().trim().email().max(200)).max(50).default([]),
  app_password: z.string().max(500).optional(), // empty/undefined = keep existing
});

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "Admin",
  });
  if (error || !data) {
    throw new Error("Forbidden: admin role required");
  }
}

export type NoReplyEmailConfig = {
  enabled: boolean;
  host: string | null;
  port: number | null;
  encryption: "none" | "ssl" | "tls" | "starttls";
  username: string | null;
  from_email: string | null;
  from_name: string | null;
  cc_recipients: string[];
  hasPassword: boolean;
  updated_at: string | null;
};

export const getNoReplyEmailConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NoReplyEmailConfig> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: cfg }, { data: sec }] = await Promise.all([
      supabaseAdmin.from("email_no_reply_config").select("*").eq("id", "default").maybeSingle(),
      supabaseAdmin.from("email_no_reply_secrets").select("app_password").eq("id", "default").maybeSingle(),
    ]);
    return {
      enabled: cfg?.enabled ?? true,
      host: cfg?.host ?? null,
      port: cfg?.port ?? null,
      encryption: (cfg?.encryption ?? "tls") as NoReplyEmailConfig["encryption"],
      username: cfg?.username ?? null,
      from_email: cfg?.from_email ?? null,
      from_name: cfg?.from_name ?? null,
      cc_recipients: (cfg?.cc_recipients ?? []) as string[],
      hasPassword: Boolean(sec?.app_password && String(sec.app_password).length > 0),
      updated_at: cfg?.updated_at ?? null,
    };
  });

export const saveNoReplyEmailConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => configSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const fromEmail = data.from_email ? data.from_email : null;

    const { error: cfgErr } = await supabaseAdmin
      .from("email_no_reply_config")
      .upsert({
        id: "default",
        enabled: data.enabled,
        host: data.host ?? null,
        port: data.port ?? null,
        encryption: data.encryption,
        username: data.username ?? null,
        from_email: fromEmail,
        from_name: data.from_name ?? null,
        cc_recipients: data.cc_recipients ?? [],
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      });
    if (cfgErr) throw new Error(cfgErr.message);

    if (typeof data.app_password === "string" && data.app_password.length > 0) {
      const { error: secErr } = await supabaseAdmin
        .from("email_no_reply_secrets")
        .upsert({
          id: "default",
          app_password: data.app_password,
          updated_at: new Date().toISOString(),
        });
      if (secErr) throw new Error(secErr.message);
    }
    return { ok: true };
  });

export const sendNoReplyTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ to: z.string().trim().email().max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: cfg }, { data: sec }] = await Promise.all([
      supabaseAdmin.from("email_no_reply_config").select("*").eq("id", "default").maybeSingle(),
      supabaseAdmin.from("email_no_reply_secrets").select("app_password").eq("id", "default").maybeSingle(),
    ]);
    if (!cfg?.enabled) throw new Error("No-Reply sending is disabled");
    if (!cfg?.host || !cfg?.port || !cfg?.from_email) {
      throw new Error("SMTP host, port, and From email are required");
    }
    if (!sec?.app_password) throw new Error("SMTP app password is not set");

    const nodemailer = (await import("nodemailer")).default;
    const enc = (cfg.encryption ?? "tls") as string;
    const transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: enc === "ssl",
      requireTLS: enc === "starttls" || enc === "tls",
      auth: cfg.username ? { user: cfg.username, pass: sec.app_password } : undefined,
    });

    const info = await transport.sendMail({
      from: cfg.from_name ? `${cfg.from_name} <${cfg.from_email}>` : cfg.from_email,
      to: data.to,
      cc: (cfg.cc_recipients ?? []) as string[],
      subject: "Test email from Re Sustainability Approvals",
      text: "This is a test message confirming your No-Reply SMTP configuration works.",
    });
    return { ok: true, messageId: info.messageId };
  });
