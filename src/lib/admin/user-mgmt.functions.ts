/**
 * User Management — admin server functions.
 * Wraps privileged operations (delete user, change built-in role) behind the
 * Admin role and blocks self-mutation.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";



const APP_ROLES = [
  "F1","F2","F3","F4","F5","F6","M1","M2","M3","M4","M5","MD",
  "S2","S3","S4","T1","T4","T5","T6","IC","ZZ","SR","C1",
  "HOD","PlantHead","SCMHead","StoreHOD","ProjectHead","FinanceHead",
  "MBD","FA","Admin",
] as const;

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "Admin").maybeSingle();
  if (!data) throw new Error("Admin only");
}

async function findSapConfigId(aliases: string[]): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, "");
  const wanted = new Set(aliases.map(norm));
  const { data } = await supabaseAdmin
    .from("sap_api_configs")
    .select("id, name, is_active");
  const match = (data ?? []).find((r) => r.is_active && wanted.has(norm(r.name)));
  return match?.id ?? null;
}


export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    sap_user_id: z.string().trim().min(1).max(60),
    first_name: z.string().trim().min(1).max(100),
    last_name: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(200),
    contact_number: z.string().trim().max(20).optional().or(z.literal("")),
    status: z.enum(["Active", "Inactive"]).default("Active"),
    mode: z.enum(["invite", "password"]),
    password: z.string().min(8).max(200).optional(),
    plants: z.array(z.string().min(1).max(20)).max(50).default([]),
    roles: z.array(z.enum(APP_ROLES)).max(50).default([]),
  }).refine((v) => v.mode !== "password" || !!v.password, {
    message: "Password is required when setting a password",
    path: ["password"],
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const full_name = `${data.first_name} ${data.last_name}`.trim();
    let newId: string | undefined;

    if (data.mode === "invite") {
      const { data: created, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        data: { full_name },
      });
      if (error) throw new Error(error.message);
      newId = created.user?.id;
    } else {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password!,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (error) throw new Error(error.message);
      newId = created.user?.id;
    }
    if (!newId) throw new Error("User creation returned no id");

    // Update profile with extended fields (handle_new_user trigger created the row)
    await supabaseAdmin.from("profiles").update({
      full_name,
      first_name: data.first_name,
      last_name: data.last_name,
      sap_user_id: data.sap_user_id,
      contact_number: data.contact_number || null,
      status: data.status,
    }).eq("id", newId);

    // Roles
    const uniqueRoles = Array.from(new Set(data.roles));
    if (uniqueRoles.length > 0) {
      await supabaseAdmin.from("user_roles").insert(
        uniqueRoles.map((role) => ({ user_id: newId!, role })),
      );
    }

    // Plants
    let matched: { id: string; code: string }[] = [];
    let skipped: string[] = [];
    if (data.plants.length > 0) {
      const codes = Array.from(new Set(data.plants.map((c) => c.trim()).filter(Boolean)));
      const { data: tRows } = await supabaseAdmin
        .from("tenants").select("id, code").in("code", codes);
      matched = (tRows ?? []) as { id: string; code: string }[];
      const found = new Set(matched.map((t) => t.code));
      skipped = codes.filter((c) => !found.has(c));
      if (matched.length > 0) {
        await supabaseAdmin.from("user_tenants").insert(
          matched.map((t, i) => ({ user_id: newId!, tenant_id: t.id, is_default: i === 0 })),
        );
      }
    }

    // Inactive users are banned from signing in
    if (data.status === "Inactive") {
      await supabaseAdmin.auth.admin.updateUserById(newId, { ban_duration: "876000h" });
    }

    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id: context.userId, action: "user.create", target_table: "auth.users", target_id: newId,
      payload: {
        email: data.email, mode: data.mode, status: data.status,
        roles: uniqueRoles, plants: data.plants, skipped_plants: skipped,
      },
    });

    return { user_id: newId, plants_added: matched.length, plants_skipped: skipped };
  });

// Backwards-compatible alias for any caller still using the invite-only shape.
export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    email: z.string().email().max(200),
    full_name: z.string().min(1).max(200),
    role: z.enum(APP_ROLES).optional(),
    plants: z.array(z.string().min(1).max(20)).max(50).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.full_name },
    });
    if (error) throw new Error(error.message);
    const newId = created.user?.id;
    if (!newId) throw new Error("Invite returned no user id");
    if (data.role) await supabaseAdmin.from("user_roles").insert({ user_id: newId, role: data.role });
    if (data.plants && data.plants.length > 0) {
      const codes = Array.from(new Set(data.plants.map((c) => c.trim()).filter(Boolean)));
      const { data: tRows } = await supabaseAdmin.from("tenants").select("id, code").in("code", codes);
      const matched = (tRows ?? []) as { id: string; code: string }[];
      if (matched.length > 0) {
        await supabaseAdmin.from("user_tenants").insert(
          matched.map((t, i) => ({ user_id: newId, tenant_id: t.id, is_default: i === 0 })),
        );
      }
    }
    return { user_id: newId };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.user_id === context.userId) throw new Error("Cannot delete your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id: context.userId, action: "user.delete", target_table: "auth.users", target_id: data.user_id,
    });
    return { ok: true };
  });

export const setBuiltInRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    user_id: z.string().uuid(),
    role: z.enum(APP_ROLES),
    action: z.enum(["add", "remove"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.user_id === context.userId && data.role === "Admin")
      throw new Error("Cannot change your own Admin role");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.action === "add") {
      await supabaseAdmin.from("user_roles").insert({ user_id: data.user_id, role: data.role });
    } else {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id).eq("role", data.role);
    }
    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id: context.userId, action: `role.${data.action}`,
      target_table: "user_roles", target_id: data.user_id, payload: { role: data.role },
    });
    return { ok: true };
  });

export const createUserViaSap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    sap_user_id: z.string().trim().min(1).max(60),
    first_name: z.string().trim().min(1).max(100),
    last_name: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(200),
    contact_number: z.string().trim().regex(/^\d{10}$/),
    password: z.string().min(8).max(200),
    confirm_password: z.string().min(8).max(200),
    status: z.enum(["Active", "Inactive"]).default("Active"),
    plants: z.array(z.string().min(1).max(20)).min(1).max(50),
    roles: z.array(z.string().trim().min(1).max(60)).min(1).max(50),
  }).refine((v) => v.password === v.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { invokeViaMiddleware } = await import("@/lib/sap/sap-client.server");

    const cfgId = await findSapConfigId(["USER_CREATE", "Create User", "CreateUser"]);
    if (!cfgId) {
      throw new Error("SAP Create User API is not configured. Add an active config named USER_CREATE (or 'Create User') in SAP API Settings.");
    }


    const uniquePlants = Array.from(new Set(data.plants.map((p) => p.trim()).filter(Boolean)));
    const uniqueRoles = Array.from(new Set(data.roles));
    const payload = {
      CREATE: {
        USER: data.sap_user_id.toUpperCase(),
        FIRST_NAME: data.first_name.toUpperCase(),
        LAST_NAME: data.last_name.toUpperCase(),
        EMAIL: data.email,
        CONTACT: data.contact_number,
        PASSWORD: data.password,
        ZCONFPSWD: data.confirm_password,
        STATUS: data.status === "Active" ? "ACTIVE" : "INACTIVE",
        PLANTS: uniquePlants.map((p) => ({ WERKS: p })),
        ROLES: uniquePlants.flatMap((p) =>
          uniqueRoles.map((r) => ({ WERKS: p, ROLE: String(r).toUpperCase() })),
        ),
      },
    };

    const result = await invokeViaMiddleware(cfgId, payload);
    const sapBody: any = result.data ?? {};
    const success = result.ok && String(sapBody?.STATUS ?? "").toUpperCase() === "TRUE";

    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: "user.sap_create",
      target_table: "sap_users",
      target_id: null,
      payload: {
        request: { ...payload.CREATE, PASSWORD: "***", ZCONFPSWD: "***" },
        response: sapBody,
        middleware_status: result.status,
        middleware_error: result.error ?? null,
        success,
      },
    });

    if (!success) {
      const msg = sapBody?.MESSAGE || result.error || `SAP rejected the request (status ${result.status})`;
      throw new Error(String(msg));
    }

    return {
      ok: true,
      message: String(sapBody?.MESSAGE ?? `User ${payload.CREATE.USER} created successfully`),
      number: sapBody?.NUMBER ?? null,
    };
  });

export const listRolesForPlants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    plants: z.array(z.string().min(1).max(20)).min(1).max(50),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { invokeViaMiddleware } = await import("@/lib/sap/sap-client.server");

    const cfgId = await findSapConfigId(["ROLE_LIST", "Get Roles", "Role List", "GetRoles", "List Roles"]);
    if (!cfgId) {
      throw new Error("SAP Role List API is not configured. Add an active config named ROLE_LIST (or 'Get Roles') in SAP API Settings.");
    }


    const uniquePlants = Array.from(new Set(data.plants.map((p) => p.trim()).filter(Boolean)));
    const payload = {
      ROLE_LIST: {
        PLANTS: uniquePlants.map((p) => ({ WERKS: p })),
      },
    };

    const result = await invokeViaMiddleware(cfgId, payload);
    const sapBody: any = result.data ?? {};
    if (!result.ok) {
      const msg = sapBody?.MESSAGE || result.error || `SAP request failed (status ${result.status})`;
      throw new Error(String(msg));
    }
    if (sapBody && typeof sapBody === "object" && "STATUS" in sapBody) {
      const status = String(sapBody.STATUS ?? "").toUpperCase();
      if (status && status !== "TRUE") {
        throw new Error(String(sapBody.MESSAGE || "SAP returned no roles"));
      }
    }

    // Extract roles from a permissive set of SAP response shapes.
    const SKIP_KEYS = new Set([
      "PLANTS", "WERKS", "STATUS", "MESSAGE", "NUMBER",
      "TYPE", "ID", "NO", "TIMESTAMP", "DATE", "TIME",
    ]);
    const ROLE_FIELDS = new Set([
      "ROLE", "ROLES", "AGR_NAME", "ROLE_ID", "ROLE_CODE", "ROLE_NAME",
      "Z_ROLE", "ZROLE", "ZAGR_NAME", "RNAME", "RID",
    ]);
    const looksLikeRole = (s: string) => {
      const t = s.trim();
      if (!t) return false;
      // exclude pure-numeric plant-like codes
      if (/^\d{1,6}$/.test(t)) return false;
      return t.length <= 60;
    };

    const out = new Set<string>();
    const visit = (node: any) => {
      if (node == null) return;
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (typeof node === "string") {
        if (looksLikeRole(node)) out.add(node.trim().toUpperCase());
        return;
      }
      if (typeof node !== "object") return;

      // Known role-bearing fields
      for (const f of ROLE_FIELDS) {
        const v = (node as any)[f];
        if (typeof v === "string" && looksLikeRole(v)) out.add(v.trim().toUpperCase());
      }
      // Row shape: { WERKS:"3801", <some>:"ADMIN" } — treat the other string as role
      if (typeof (node as any).WERKS === "string") {
        for (const [k, v] of Object.entries(node)) {
          if (k === "WERKS" || SKIP_KEYS.has(k)) continue;
          if (typeof v === "string" && looksLikeRole(v)) out.add(v.trim().toUpperCase());
        }
      }
      // Recurse into every non-skipped child
      for (const [k, v] of Object.entries(node)) {
        if (SKIP_KEYS.has(k)) continue;
        if (v && (typeof v === "object")) visit(v);
      }
    };
    visit(sapBody);

    const roles = Array.from(out).filter(Boolean).sort();

    // Audit (best-effort, truncated) for future shape debugging
    try {
      const snapshot = JSON.stringify(sapBody).slice(0, 4000);
      await supabaseAdmin.from("admin_audit_log").insert({
        actor_id: context.userId,
        action: "user.sap_role_list",
        target_table: "sap_roles",
        target_id: null,
        payload: { request: payload, response_snapshot: snapshot, roles_count: roles.length },
      });
    } catch {/* ignore audit failure */}

    return { roles };
  });

export const createCustomRoleViaSap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    name: z.string().trim().min(1).max(60),
    description: z.string().trim().max(240).optional().or(z.literal("")),
    tenant_id: z.string().trim().optional().or(z.literal("")),
    screen_keys: z.array(z.string().trim().min(1).max(80)).min(1).max(50),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { invokeViaMiddleware } = await import("@/lib/sap/sap-client.server");

    const cfgId = await findSapConfigId(["ROLE_CREATE", "Create Role", "CreateRole"]);
    if (!cfgId) {
      throw new Error("SAP Create Role API is not configured. Add an active config named ROLE_CREATE (or 'Create Role') in SAP API Settings.");
    }


    const uniqueScreens = Array.from(new Set(data.screen_keys.map((k) => k.trim()).filter(Boolean)));
    const payload = {
      CREATE: {
        ROLE: data.name.toUpperCase(),
        ROLE_DES: data.description || "",
        ACTIVITY: uniqueScreens.map((k) => ({
          ACTIVITY: k.toUpperCase(),
          RELEASE_CODE: k,
        })),
      },
    };

    const result = await invokeViaMiddleware(cfgId, payload);
    const sapBody: any = result.data ?? {};
    const statusStr = String(sapBody?.STATUS ?? "").toUpperCase();
    const success = result.ok && (statusStr === "SUCCESS" || statusStr === "TRUE" || statusStr === "");

    let dbError: string | null = null;
    let newRoleId: string | null = null;
    if (success) {
      const { data: inserted, error: insErr } = await supabaseAdmin.from("custom_roles").insert({
        name: data.name,
        description: data.description || null,
        tenant_id: data.tenant_id || null,
      }).select("id").maybeSingle();
      if (insErr) {
        dbError = insErr.message;
      } else if (inserted?.id) {
        newRoleId = inserted.id;
        const permRows = uniqueScreens.map((k) => ({
          custom_role_id: newRoleId!,
          screen_key: k,
          action: "view",
          allowed: true,
        }));
        const { error: permErr } = await supabaseAdmin.from("role_permissions").insert(permRows);
        if (permErr) dbError = permErr.message;
      }
    }

    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: "user.sap_role_create",
      target_table: "custom_roles",
      target_id: newRoleId,
      payload: {
        request: payload.CREATE,
        screen_keys: uniqueScreens,
        response: sapBody,
        middleware_status: result.status,
        middleware_error: result.error ?? null,
        success,
        db_error: dbError,
      },
    });

    if (!success) {
      const msg = sapBody?.MESSAGE || result.error || `SAP rejected the request (status ${result.status})`;
      throw new Error(String(msg));
    }

    return {
      ok: true,
      message: String(sapBody?.MESSAGE ?? `Role ${payload.CREATE.ROLE} created successfully`),
      number: sapBody?.NUMBER ?? null,
      db_error: dbError,
    };
  });



