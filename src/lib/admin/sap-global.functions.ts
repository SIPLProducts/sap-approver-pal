/**
 * Global SAP middleware settings — admin server functions.
 * Singleton row in sap_global_settings; secret lives in sap_global_secrets
 * (service-role-only) and is never returned to the client.
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
      .select("proxy_secret")
      .eq("id", "default")
      .maybeSingle();
    return {
      settings: row ?? {
        id: "default",
        connection_mode: "direct",
        deployment_mode: "lovable_cloud",
        middleware_port: 3002,
        middleware_url: null,
      },
      proxy_secret_set: !!secret?.proxy_secret,
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
