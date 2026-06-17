/**
 * SAP API Settings — admin server functions.
 * All operations require the Admin role. Credentials live in a
 * service-role-only table and are never returned to the client.
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

const ConfigSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  module: z.enum(["MM", "SD", "COMMON"]).default("COMMON"),
  endpoint_url: z.string().url().max(500),
  http_method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]).default("GET"),
  auth_type: z.enum(["basic", "oauth", "none", "proxy"]).default("basic"),
  middleware_url: z.string().max(500).optional().nullable(),
  proxy_secret_ref: z.string().max(120).optional().nullable(),
  api_type: z.enum(["sync", "fetch"]).default("fetch"),
  auto_sync_enabled: z.boolean().default(false),
  schedule_cron: z.string().max(120).optional().nullable(),
  is_active: z.boolean().default(true),
});

export const listSapConfigs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("sap_api_configs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { configs: data ?? [] };
  });

export const getSapConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: cfg }, { data: req }, { data: res }, { data: creds }] = await Promise.all([
      supabaseAdmin.from("sap_api_configs").select("*").eq("id", data.id).maybeSingle(),
      supabaseAdmin.from("sap_api_request_fields").select("*").eq("config_id", data.id).order("sort_order"),
      supabaseAdmin.from("sap_api_response_fields").select("*").eq("config_id", data.id).order("sort_order"),
      supabaseAdmin.from("sap_api_credentials").select("config_id, username, extra_headers, updated_at").eq("config_id", data.id).maybeSingle(),
    ]);
    if (!cfg) throw new Error("Not found");
    return {
      config: cfg,
      requestFields: req ?? [],
      responseFields: res ?? [],
      credentials: creds ? { ...creds, password_set: true } : { config_id: data.id, username: null, extra_headers: {}, password_set: false },
    };
  });

export const upsertSapConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ConfigSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.auth_type === "proxy" && (!data.middleware_url || !data.proxy_secret_ref)) {
      throw new Error("Proxy mode requires middleware_url and proxy_secret_ref (MIDDLEWARE_SHARED_SECRET).");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = { ...data, created_by: context.userId };
    const { data: row, error } = data.id
      ? await supabaseAdmin.from("sap_api_configs").update(payload).eq("id", data.id).select().single()
      : await supabaseAdmin.from("sap_api_configs").insert(payload).select().single();
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id: context.userId, action: data.id ? "sap_config.update" : "sap_config.create",
      target_table: "sap_api_configs", target_id: row.id, payload: data,
    });
    return { config: row };
  });

export const deleteSapConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("sap_api_configs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id: context.userId, action: "sap_config.delete", target_table: "sap_api_configs", target_id: data.id,
    });
    return { ok: true };
  });

const FieldRowSchema = z.object({
  field_name: z.string().min(1).max(120),
  source: z.enum(["static", "column", "expr", "secret"]).default("static"),
  default_value: z.string().max(500).optional().nullable(),
  required: z.boolean().default(false),
  sort_order: z.number().int().default(0),
});

export const replaceRequestFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ config_id: z.string().uuid(), fields: z.array(FieldRowSchema).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("sap_api_request_fields").delete().eq("config_id", data.config_id);
    if (data.fields.length) {
      const { error } = await supabaseAdmin.from("sap_api_request_fields")
        .insert(data.fields.map((f, i) => ({ ...f, config_id: data.config_id, sort_order: f.sort_order ?? i })));
      if (error) throw new Error(error.message);
    }
    return { ok: true, count: data.fields.length };
  });

const ResponseRowSchema = z.object({
  field_name: z.string().min(1).max(120),
  target_table: z.string().max(120).optional().nullable(),
  target_column: z.string().max(120).optional().nullable(),
  transform_expr: z.string().max(500).optional().nullable(),
  sort_order: z.number().int().default(0),
});

export const replaceResponseFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ config_id: z.string().uuid(), fields: z.array(ResponseRowSchema).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("sap_api_response_fields").delete().eq("config_id", data.config_id);
    if (data.fields.length) {
      const { error } = await supabaseAdmin.from("sap_api_response_fields")
        .insert(data.fields.map((f, i) => ({ ...f, config_id: data.config_id, sort_order: f.sort_order ?? i })));
      if (error) throw new Error(error.message);
    }
    return { ok: true, count: data.fields.length };
  });

export const upsertCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    config_id: z.string().uuid(),
    username: z.string().max(200).optional().nullable(),
    password: z.string().max(500).optional().nullable(),
    extra_headers: z.record(z.string(), z.string()).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Note: v1 stores password as-is in service-role-only table. Vault encryption is a follow-up.
    const update = {
      config_id: data.config_id,
      username: data.username ?? null,
      extra_headers: data.extra_headers ?? {},
      ...(data.password ? { password_encrypted: data.password } : {}),
    };
    const { error } = await supabaseAdmin.from("sap_api_credentials").upsert(update);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id: context.userId, action: "sap_credentials.update",
      target_table: "sap_api_credentials", target_id: data.config_id,
      payload: { username: data.username, password_changed: !!data.password },
    });
    return { ok: true };
  });

export const testSapConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cfg } = await supabaseAdmin.from("sap_api_configs").select("*").eq("id", data.id).maybeSingle();
    if (!cfg) throw new Error("Config not found");
    const { data: creds } = await supabaseAdmin.from("sap_api_credentials").select("*").eq("config_id", data.id).maybeSingle();
    const { data: global } = await supabaseAdmin
      .from("sap_global_settings")
      .select("sap_base_url, sap_username")
      .eq("id", "default")
      .maybeSingle();
    const { data: globalSecret } = await supabaseAdmin
      .from("sap_global_secrets")
      .select("sap_password")
      .eq("id", "default")
      .maybeSingle();

    const { resolveSapUrl } = await import("@/lib/sap/url");
    let target = resolveSapUrl(cfg.endpoint_url, global?.sap_base_url ?? null);
    let method: "GET" | "HEAD" | "POST" = "HEAD";
    let body: string | undefined;
    const headers: Record<string, string> = { Accept: "application/json" };

    if (cfg.auth_type === "proxy") {
      const { data: g } = await supabaseAdmin.from("sap_global_settings").select("middleware_url").eq("id", "default").maybeSingle();
      const { data: gs } = await supabaseAdmin.from("sap_global_secrets").select("proxy_secret").eq("id", "default").maybeSingle();
      if (!g?.middleware_url) throw new Error("Global Node.js Middleware URL is not configured. Set it in SAP API Settings → Middleware Configuration.");
      target = `${g.middleware_url.replace(/\/$/, "")}/sap/test`;
      method = "POST";
      headers["Content-Type"] = "application/json";
      if (gs?.proxy_secret) headers["x-shared-secret"] = gs.proxy_secret;
      body = JSON.stringify({ configId: data.id });
    } else {
      const user = creds?.username ?? global?.sap_username ?? null;
      const pass = creds?.password_encrypted ?? globalSecret?.sap_password ?? null;
      if (cfg.auth_type === "basic" && user && pass) {
        headers.Authorization = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
      }
      for (const [k, v] of Object.entries((creds?.extra_headers ?? {}) as Record<string, string>)) headers[k] = v;
    }

    const t0 = Date.now();
    let ok = false, status = 0, message = "";
    try {
      const res = await fetch(target, { method, headers, body });
      status = res.status;
      ok = res.ok;
      message = `${res.status} ${res.statusText}`;
    } catch (e) {
      message = (e as Error).message;
    }

    const latency_ms = Date.now() - t0;
    await supabaseAdmin.from("sap_api_sync_log").insert({
      config_id: data.id, status: ok ? "ok" : "error", latency_ms, message: `test: ${message}`,
    });
    return { ok, status, latency_ms, message };
  });
