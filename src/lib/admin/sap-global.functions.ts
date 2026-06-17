/**
 * Global SAP middleware settings — admin server functions.
 * Singleton row in sap_global_settings; secrets (proxy_secret, sap_password)
 * live in sap_global_secrets (service-role-only) and are never returned to
 * the client.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "Admin")
    .maybeSingle();
  if (!data) throw new Error("Admin only");
}

const SettingsSchema = z.object({
  connection_mode: z.enum(["direct", "via_proxy"]).default("direct"),
  deployment_mode: z.enum(["lovable_cloud", "self_hosted"]).default("lovable_cloud"),
  middleware_port: z.coerce.number().int().min(1).max(65535).default(3002),
  middleware_url: z.string().max(500).optional().nullable(),
  proxy_secret: z.string().max(500).optional().nullable(),
});

const SapConnectionSchema = z.object({
  sap_environment: z.string().max(60).optional().nullable(),
  sap_base_url: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .refine(
      (v) => !v || /^https?:\/\/[^\s]+$/i.test(v.trim()),
      "SAP Base URL must start with http:// or https://",
    ),
  sap_username: z.string().max(200).optional().nullable(),
  sap_password: z.string().max(500).optional().nullable(),
});

export const getSapGlobalSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("sap_global_settings")
      .select("*")
      .eq("id", "default")
      .maybeSingle();
    const { data: secret } = await supabaseAdmin
      .from("sap_global_secrets")
      .select("proxy_secret, sap_password")
      .eq("id", "default")
      .maybeSingle();
    return {
      settings: row ?? {
        id: "default",
        connection_mode: "direct",
        deployment_mode: "lovable_cloud",
        middleware_port: 3002,
        middleware_url: null,
        sap_environment: null,
        sap_base_url: null,
        sap_username: null,
      },
      proxy_secret_set: !!secret?.proxy_secret,
      sap_password_set: !!secret?.sap_password,
    };
  });

export const upsertSapGlobalSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SettingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existingSecret } = await supabaseAdmin
      .from("sap_global_secrets")
      .select("proxy_secret")
      .eq("id", "default")
      .maybeSingle();
    const newSecret = data.proxy_secret && data.proxy_secret.length > 0 ? data.proxy_secret : existingSecret?.proxy_secret ?? null;

    if (data.connection_mode === "via_proxy") {
      if (!data.middleware_url) throw new Error("Node.js Middleware URL is required when Connection Mode = Via Proxy.");
      if (!newSecret) throw new Error("Proxy Secret / Password is required when Connection Mode = Via Proxy.");
    }

    const { error: upErr } = await supabaseAdmin.from("sap_global_settings").upsert({
      id: "default",
      connection_mode: data.connection_mode,
      deployment_mode: data.deployment_mode,
      middleware_port: data.middleware_port,
      middleware_url: data.middleware_url ?? null,
      updated_by: context.userId,
    });
    if (upErr) throw new Error(upErr.message);

    if (data.proxy_secret !== undefined && data.proxy_secret !== null && data.proxy_secret.length > 0) {
      const { error: secErr } = await supabaseAdmin
        .from("sap_global_secrets")
        .upsert({ id: "default", proxy_secret: data.proxy_secret });
      if (secErr) throw new Error(secErr.message);
    }

    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: "sap_global_settings.update",
      target_table: "sap_global_settings",
      target_id: null,
      payload: {
        connection_mode: data.connection_mode,
        deployment_mode: data.deployment_mode,
        middleware_port: data.middleware_port,
        middleware_url_set: !!data.middleware_url,
        secret_changed: !!(data.proxy_secret && data.proxy_secret.length > 0),
      },
    });

    return { ok: true };
  });

export const upsertSapConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SapConnectionSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const baseUrl = data.sap_base_url?.trim().replace(/\/+$/, "") || null;
    const { error: upErr } = await supabaseAdmin.from("sap_global_settings").upsert({
      id: "default",
      sap_environment: data.sap_environment?.trim() || null,
      sap_base_url: baseUrl,
      sap_username: data.sap_username?.trim() || null,
      updated_by: context.userId,
    });
    if (upErr) throw new Error(upErr.message);

    if (data.sap_password && data.sap_password.length > 0) {
      const { error: secErr } = await supabaseAdmin
        .from("sap_global_secrets")
        .upsert({ id: "default", sap_password: data.sap_password });
      if (secErr) throw new Error(secErr.message);
    }

    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: "sap_connection.update",
      target_table: "sap_global_settings",
      target_id: null,
      payload: {
        sap_environment: data.sap_environment ?? null,
        sap_base_url_set: !!baseUrl,
        sap_username_set: !!data.sap_username,
        sap_password_changed: !!(data.sap_password && data.sap_password.length > 0),
      },
    });

    return { ok: true };
  });

export const testSapConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("sap_global_settings")
      .select("sap_base_url, sap_username")
      .eq("id", "default")
      .maybeSingle();
    if (!row?.sap_base_url) return { ok: false, latency_ms: 0, message: "No SAP Base URL configured." };
    const { data: secret } = await supabaseAdmin
      .from("sap_global_secrets")
      .select("sap_password")
      .eq("id", "default")
      .maybeSingle();
    const url = row.sap_base_url.replace(/\/+$/, "") + "/";
    const headers: Record<string, string> = { Accept: "*/*" };
    if (row.sap_username && secret?.sap_password) {
      headers.Authorization =
        "Basic " + Buffer.from(`${row.sap_username}:${secret.sap_password}`).toString("base64");
    }
    const t0 = Date.now();
    try {
      const r = await fetch(url, { method: "HEAD", headers });
      return { ok: r.status < 500, latency_ms: Date.now() - t0, message: `${r.status} ${r.statusText}` };
    } catch (e) {
      return { ok: false, latency_ms: Date.now() - t0, message: (e as Error).message };
    }
  });

export const testGlobalMiddleware = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("sap_global_settings")
      .select("*")
      .eq("id", "default")
      .maybeSingle();
    if (!row?.middleware_url) return { ok: false, latency_ms: 0, message: "No middleware URL configured." };
    const { data: secret } = await supabaseAdmin
      .from("sap_global_secrets")
      .select("proxy_secret")
      .eq("id", "default")
      .maybeSingle();
    const url = `${row.middleware_url.replace(/\/$/, "")}/__health`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (secret?.proxy_secret) headers["x-shared-secret"] = secret.proxy_secret;
    const t0 = Date.now();
    try {
      const r = await fetch(url, { method: "GET", headers });
      return { ok: r.ok, latency_ms: Date.now() - t0, message: `${r.status} ${r.statusText}` };
    } catch (e) {
      return { ok: false, latency_ms: Date.now() - t0, message: (e as Error).message };
    }
  });
