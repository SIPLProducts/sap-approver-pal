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
  const { assertAnyScreen } = await import("@/lib/admin/assert-screen");
  await assertAnyScreen(userId, [
    "admin.users",
    "admin.custom_roles",
    "admin.role_permissions",
  ]);
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

function pickField(obj: any, key: string): any {
  if (obj == null || typeof obj !== "object") return undefined;
  if (obj[key] !== undefined) return obj[key];
  const lower = key.toLowerCase();
  if (obj[lower] !== undefined) return obj[lower];
  const upper = key.toUpperCase();
  if (obj[upper] !== undefined) return obj[upper];
  for (const k of Object.keys(obj)) {
    if (k.toLowerCase() === lower) return obj[k];
  }
  return undefined;
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
  .inputValidator((d) => z.object({ user_id: z.string().trim().min(1).max(60) }).parse(d))
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
    user_id: z.string().trim().min(1).max(60),
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
    roles: z.array(z.object({
      plant: z.string().trim().min(1).max(20),
      role: z.string().trim().min(1).max(60),
    })).min(1).max(200),
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
    const inner = {
      USER: data.sap_user_id.toUpperCase(),
      FIRST_NAME: data.first_name.toUpperCase(),
      LAST_NAME: data.last_name.toUpperCase(),
      EMAIL: data.email,
      CONTACT: data.contact_number,
      PASSWORD: data.password,
      ZCONFPSWD: data.confirm_password,
      STATUS: data.status === "Active" ? "ACTIVE" : "INACTIVE",
      PLANTS: uniquePlants.map((p) => ({ WERKS: p })),
      ROLES: data.roles.map(({ plant, role }) => ({
        WERKS: plant.trim(),
        ROLE: String(role).trim().toUpperCase(),
      })),
    };
    const payload = { CREATE: inner };

    const result = await invokeViaMiddleware(cfgId, payload);
    const sapBody: any = result.data ?? {};
    const rawStatus = pickField(sapBody, "STATUS");
    const statusStr = String(rawStatus ?? "").toUpperCase();
    const sapMessage = pickField(sapBody, "MESSAGE");
    const sapNumber = pickField(sapBody, "NUMBER");
    const isExplicitError = statusStr === "ERROR" || statusStr === "FAIL" || statusStr === "FAILURE" || statusStr === "FALSE" || statusStr === "E";
    const isExplicitSuccess = statusStr === "SUCCESS" || statusStr === "TRUE" || statusStr === "S" || statusStr === "OK";
    const success = result.ok && !isExplicitError && (isExplicitSuccess || statusStr === "");

    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: "user.sap_create",
      target_table: "sap_users",
      target_id: null,
      payload: {
        request: { CREATE: { ...inner, PASSWORD: "***", ZCONFPSWD: "***" } },
        response: sapBody,
        middleware_status: result.status,
        middleware_error: result.error ?? null,
        success,
      },
    });

    if (!success) {
      const msg = sapMessage || result.error || `SAP rejected the request (status ${result.status})`;
      throw new Error(String(msg));
    }

    return {
      ok: true,
      message: String(sapMessage ?? `User ${inner.USER} created successfully`),
      number: sapNumber ?? null,
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


    const { screenKeyToActivity, PERMISSION_ACTIONS } = await import("@/lib/admin/screen-keys");
    const uniqueScreens = Array.from(new Set(data.screen_keys.map((k) => k.trim()).filter(Boolean)));
    const inner = {
      ROLE: data.name.toUpperCase(),
      ROLE_DES: data.description || "",
      ACTIVITY: uniqueScreens.map((k) => ({
        ACTIVITY: screenKeyToActivity(k),
        RELEASE_CODE: "",
      })),
    };
    // Middleware config has a single `CREATE` column field; it forwards
    // inputs.CREATE verbatim, which produces the nested JSON SAP expects.
    const payload = { CREATE: inner };

    const result = await invokeViaMiddleware(cfgId, payload);
    const sapBody: any = result.data ?? {};
    const rawStatus = pickField(sapBody, "STATUS");
    const statusStr = String(rawStatus ?? "").toUpperCase();
    const sapMessage = pickField(sapBody, "MESSAGE");
    const sapNumber = pickField(sapBody, "NUMBER");
    const isExplicitError = statusStr === "ERROR" || statusStr === "FAIL" || statusStr === "FAILURE" || statusStr === "FALSE" || statusStr === "E";
    const isExplicitSuccess = statusStr === "SUCCESS" || statusStr === "TRUE" || statusStr === "S" || statusStr === "OK";
    const success = result.ok && !isExplicitError && (isExplicitSuccess || statusStr === "");


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
        const permRows = uniqueScreens.flatMap((k) =>
          PERMISSION_ACTIONS.map((action) => ({
            custom_role_id: newRoleId!,
            screen_key: k,
            action,
            allowed: true,
          })),
        );
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
      const msg = sapMessage || result.error || `SAP rejected the request (status ${result.status})`;
      throw new Error(String(msg));
    }

    return {
      ok: true,
      message: String(sapMessage ?? `Role ${payload.CREATE.ROLE} created successfully`),
      number: sapNumber ?? null,
      db_error: dbError,
    };

  });

function firstArray(node: any, keys: string[]): any[] {
  if (!node) return [];
  if (Array.isArray(node)) return node;
  if (typeof node !== "object") return [];
  for (const k of keys) {
    const v = pickField(node, k);
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") {
      const inner = firstArray(v, keys);
      if (inner.length) return inner;
    }
  }
  // first array child anywhere
  for (const v of Object.values(node)) {
    if (Array.isArray(v)) return v;
  }
  for (const v of Object.values(node)) {
    if (v && typeof v === "object") {
      const inner = firstArray(v, keys);
      if (inner.length) return inner;
    }
  }
  return [];
}

function collectStrings(node: any, codeKeys: string[]): string[] {
  if (node == null) return [];
  if (typeof node === "string" || typeof node === "number") {
    const s = String(node).trim();
    return s ? [s] : [];
  }
  if (Array.isArray(node)) {
    const out: string[] = [];
    for (const v of node) out.push(...collectStrings(v, codeKeys));
    return out;
  }
  if (typeof node === "object") {
    for (const k of codeKeys) {
      const v = (node as any)[k] ?? pickField(node, k);
      if (typeof v === "string" || typeof v === "number") {
        const s = String(v).trim();
        if (s) return [s];
      }
    }
  }
  return [];
}

export const listUsersViaSap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { invokeViaMiddleware } = await import("@/lib/sap/sap-client.server");

    const cfgId = await findSapConfigId([
      "USER_DISPLAY_TABLE", "Create_User_Display_Table", "CreateUserDisplayTable",
      "User Display Table", "USER_LIST", "Display User Table",
    ]);
    if (!cfgId) {
      throw new Error("SAP Create_User_Display_Table API is not configured. Add an active config named Create_User_Display_Table in SAP API Settings.");
    }

    const result = await invokeViaMiddleware(cfgId, {});
    const sapBody: any = result.data ?? {};
    const rawStatus = pickField(sapBody, "STATUS");
    const statusStr = String(rawStatus ?? "").toUpperCase();
    const isErr = statusStr === "ERROR" || statusStr === "FAIL" || statusStr === "FAILURE" || statusStr === "FALSE" || statusStr === "E";
    if (!result.ok || isErr) {
      const msg = pickField(sapBody, "MESSAGE") || result.error || `SAP request failed (status ${result.status})`;
      throw new Error(String(msg));
    }

    const rows = firstArray(sapBody, [
      "DATA", "ITEMS", "RESULTS", "USERS", "USER_LIST", "TABLE", "DISPLAY", "T_USER", "ET_USER",
    ]);

    type Row = {
      user: string;
      first_name: string;
      last_name: string;
      full_name: string;
      email: string;
      contact: string;
      status: string;
      password: string;
      confirm_password: string;
      plants: string[];
      roles: string[];
      role_assignments: { werks: string; role: string }[];
      raw: any;
    };

    const normStatus = (s: string) => {
      const u = s.trim().toUpperCase();
      if (!u) return "";
      if (u === "A" || u === "ACTIVE" || u === "TRUE" || u === "1") return "ACTIVE";
      if (u === "I" || u === "INACTIVE" || u === "FALSE" || u === "0") return "INACTIVE";
      return u;
    };

    const byUser = new Map<string, Row & { _plants: Set<string>; _roles: Set<string>; _assignments: Set<string> }>();

    for (const r of rows) {
      if (r == null || typeof r !== "object") continue;
      const user = String(
        pickField(r, "ZUSER") ?? pickField(r, "USER") ?? pickField(r, "EMPNO") ??
        pickField(r, "SAP_USER_ID") ?? pickField(r, "USERNAME") ?? ""
      ).trim();
      if (!user) continue;
      const key = user.toUpperCase();

      const first = String(pickField(r, "ZFIRST_NAME") ?? pickField(r, "FIRST_NAME") ?? pickField(r, "FNAME") ?? "").trim();
      const last = String(pickField(r, "ZLAST_NAME") ?? pickField(r, "LAST_NAME") ?? pickField(r, "LNAME") ?? "").trim();
      const full = String(pickField(r, "FULL_NAME") ?? pickField(r, "NAME") ?? `${first} ${last}`.trim()).trim();
      const email = String(pickField(r, "ZEMAIL") ?? pickField(r, "EMAIL") ?? pickField(r, "SMTP_ADDR") ?? "").trim();
      const contact = String(pickField(r, "ZCONTACT") ?? pickField(r, "CONTACT") ?? pickField(r, "MOBILE") ?? pickField(r, "TEL_NUMBER") ?? "").trim();
      const status = normStatus(String(pickField(r, "ZSTATUS") ?? pickField(r, "STATUS") ?? ""));
      const password = String(pickField(r, "ZPASSWORD") ?? pickField(r, "PASSWORD") ?? "").trim();
      const confirmPassword = String(pickField(r, "ZCONFPSWD") ?? pickField(r, "CONFPSWD") ?? pickField(r, "CONFIRM_PASSWORD") ?? "").trim();

      // Single-row plant/role (Z-prefixed flat shape)
      const singlePlant = String(pickField(r, "ZWERKS") ?? "").trim();
      const singleRole = String(pickField(r, "ZROLE") ?? "").trim();

      // Nested arrays (forward-compat for future shape)
      const plantsNode = pickField(r, "PLANTS") ?? pickField(r, "PLANT") ?? pickField(r, "WERKS");
      let nestedPlants: string[] = [];
      if (Array.isArray(plantsNode)) {
        const acc = new Set<string>();
        for (const p of plantsNode) for (const s of collectStrings(p, ["WERKS", "PLANT", "VKORG"])) acc.add(s);
        nestedPlants = Array.from(acc);
      } else if (plantsNode != null && typeof plantsNode !== "string" && typeof plantsNode !== "number") {
        nestedPlants = collectStrings(plantsNode, ["WERKS", "PLANT", "VKORG"]);
      }

      const rolesNode = pickField(r, "ROLES") ?? pickField(r, "ROLE");
      let nestedRoles: string[] = [];
      const nestedRoleAssignments: Array<{ werks: string; role: string }> = [];
      if (Array.isArray(rolesNode)) {
        const acc = new Set<string>();
        for (const ro of rolesNode) {
          for (const s of collectStrings(ro, ["ROLE", "AGR_NAME", "ROLE_NAME"])) acc.add(s.toUpperCase());
          if (ro && typeof ro === "object") {
            const w = String((ro as any).WERKS ?? (ro as any).PLANT ?? "").trim();
            const rn = String((ro as any).ROLE ?? (ro as any).AGR_NAME ?? (ro as any).ROLE_NAME ?? "").trim().toUpperCase();
            if (w && rn) nestedRoleAssignments.push({ werks: w, role: rn });
          }
        }
        nestedRoles = Array.from(acc);
      } else if (rolesNode != null && typeof rolesNode !== "string" && typeof rolesNode !== "number") {
        nestedRoles = collectStrings(rolesNode, ["ROLE", "AGR_NAME", "ROLE_NAME"]).map((s) => s.toUpperCase());
      }

      let entry = byUser.get(key);
      if (!entry) {
        entry = {
          user,
          first_name: first,
          last_name: last,
          full_name: full,
          email,
          contact,
          status,
          password,
          confirm_password: confirmPassword,
          plants: [],
          roles: [],
          role_assignments: [],
          raw: r,
          _plants: new Set<string>(),
          _roles: new Set<string>(),
          _assignments: new Set<string>(),
        };
        byUser.set(key, entry);
      } else {
        if (!entry.first_name && first) entry.first_name = first;
        if (!entry.last_name && last) entry.last_name = last;
        if (!entry.full_name && full) entry.full_name = full;
        if (!entry.email && email) entry.email = email;
        if (!entry.contact && contact) entry.contact = contact;
        if (!entry.status && status) entry.status = status;
        if (!entry.password && password) entry.password = password;
        if (!entry.confirm_password && confirmPassword) entry.confirm_password = confirmPassword;
      }
      if (singlePlant) entry._plants.add(singlePlant);
      for (const p of nestedPlants) entry._plants.add(p);
      if (singleRole) entry._roles.add(singleRole.toUpperCase());
      for (const ro of nestedRoles) entry._roles.add(ro);
      // Capture (plant, role) pairs from this row
      if (singlePlant && singleRole) {
        entry._assignments.add(`${singlePlant}|${singleRole.toUpperCase()}`);
      }
      for (const a of nestedRoleAssignments) {
        entry._assignments.add(`${a.werks}|${a.role}`);
      }
    }

    const users: Row[] = Array.from(byUser.values()).map((e) => ({
      user: e.user,
      first_name: e.first_name,
      last_name: e.last_name,
      full_name: e.full_name || `${e.first_name} ${e.last_name}`.trim() || e.user,
      email: e.email,
      contact: e.contact,
      status: e.status,
      plants: Array.from(e._plants).sort(),
      roles: Array.from(e._roles).sort(),
      role_assignments: Array.from(e._assignments).sort().map((s) => {
        const [werks, role] = s.split("|");
        return { werks, role };
      }),
      raw: e.raw,
    }));

    try {
      await supabaseAdmin.from("admin_audit_log").insert({
        actor_id: context.userId,
        action: "user.sap_user_list",
        target_table: "sap_users",
        target_id: null,
        payload: {
          rows: users.length,
          raw_rows: rows.length,
          sample_keys: rows[0] && typeof rows[0] === "object" ? Object.keys(rows[0]) : [],
          middleware_status: result.status,
        },
      });
    } catch {/* ignore */}

    return { users };

  });





export const editUserViaSap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    sap_user_id: z.string().trim().min(1).max(60),
    first_name: z.string().trim().min(1).max(100),
    last_name: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(200),
    contact_number: z.string().trim().regex(/^\d{10}$/),
    password: z.string().max(200).optional().default(""),
    confirm_password: z.string().max(200).optional().default(""),
    status: z.enum(["Active", "Inactive"]).default("Active"),
    plants: z.array(z.string().min(1).max(20)).min(1).max(50),
    roles: z.array(z.object({
      plant: z.string().trim().min(1).max(20),
      role: z.string().trim().min(1).max(60),
    })).min(1).max(200),
  }).refine((v) => !v.password || v.password === v.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  }).refine((v) => !v.password || v.password.length >= 8, {
    message: "Password must be at least 8 characters",
    path: ["password"],
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { invokeViaMiddleware } = await import("@/lib/sap/sap-client.server");

    const cfgId = await findSapConfigId(["Edit_User", "EDITUSER", "Edit User"]);
    if (!cfgId) {
      throw new Error("SAP Edit User API is not configured. Add an active config named Edit_User (or 'Edit User') in SAP API Settings.");
    }

    const uniquePlants = Array.from(new Set(data.plants.map((p) => p.trim()).filter(Boolean)));
    const inner: Record<string, unknown> = {
      USER: data.sap_user_id.toUpperCase(),
      FIRST_NAME: data.first_name.toUpperCase(),
      LAST_NAME: data.last_name.toUpperCase(),
      EMAIL: data.email,
      CONTACT: data.contact_number,
      STATUS: data.status === "Active" ? "ACTIVE" : "INACTIVE",
      PLANTS: uniquePlants.map((p) => ({ WERKS: p })),
      ROLES: data.roles.map(({ plant, role }) => ({
        WERKS: plant.trim(),
        ROLE: String(role).trim().toUpperCase(),
      })),
    };
    // Only forward PASSWORD/ZCONFPSWD when the operator opted in to change
    // the password. Sending a masked sentinel would overwrite the real
    // password in SAP with literal asterisks.
    if (data.password) {
      inner.PASSWORD = data.password;
      inner.ZCONFPSWD = data.confirm_password || data.password;
    }
    const payload = { EDIT: inner };

    const result = await invokeViaMiddleware(cfgId, payload);
    const sapBody: any = result.data ?? {};
    const rawStatus = pickField(sapBody, "STATUS");
    const statusStr = String(rawStatus ?? "").toUpperCase();
    const sapMessage = pickField(sapBody, "MESSAGE");
    const sapNumber = pickField(sapBody, "NUMBER");
    const isExplicitError = statusStr === "ERROR" || statusStr === "FAIL" || statusStr === "FAILURE" || statusStr === "FALSE" || statusStr === "E";
    const isExplicitSuccess = statusStr === "SUCCESS" || statusStr === "TRUE" || statusStr === "S" || statusStr === "OK";
    const success = result.ok && !isExplicitError && (isExplicitSuccess || statusStr === "");

    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: "user.sap_edit",
      target_table: "sap_users",
      target_id: null,
      payload: {
        request: {
          EDIT: {
            ...inner,
            ...(inner.PASSWORD ? { PASSWORD: "***", ZCONFPSWD: "***" } : {}),
          },
        },
        response: sapBody,
        middleware_status: result.status,
        middleware_error: result.error ?? null,
        success,
      },
    });

    if (!success) {
      const msg = sapMessage || result.error || `SAP rejected the request (status ${result.status})`;
      throw new Error(String(msg));
    }

    return {
      ok: true,
      message: String(sapMessage ?? `User ${inner.USER} updated successfully`),
      number: sapNumber ?? null,
    };
  });

export const editCustomRoleViaSap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    role_id: z.string().trim().min(1).max(60),
    name: z.string().trim().min(1).max(60),
    description: z.string().trim().max(240).optional().or(z.literal("")),
    tenant_id: z.string().trim().optional().or(z.literal("")),
    screen_keys: z.array(z.string().trim().min(1).max(80)).min(1).max(50),
    is_active: z.boolean().default(true),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { invokeViaMiddleware } = await import("@/lib/sap/sap-client.server");

    const cfgId = await findSapConfigId(["Edit_Role", "EDITROLE", "Edit Role"]);
    if (!cfgId) {
      throw new Error("SAP Edit Role API is not configured. Add an active config named Edit_Role (or 'Edit Role') in SAP API Settings.");
    }

    const { screenKeyToActivity, PERMISSION_ACTIONS } = await import("@/lib/admin/screen-keys");
    const uniqueScreens = Array.from(new Set(data.screen_keys.map((k) => k.trim()).filter(Boolean)));
    const inner = {
      ROLE: data.name.toUpperCase(),
      ROLE_DES: data.description || "",
      ACTIVITY: uniqueScreens.map((k) => ({
        ACTIVITY: screenKeyToActivity(k),
        RELEASE_CODE: "",
      })),
    };
    const payload = { EDIT: inner };

    const result = await invokeViaMiddleware(cfgId, payload);
    const sapBody: any = result.data ?? {};
    const rawStatus = pickField(sapBody, "STATUS");
    const statusStr = String(rawStatus ?? "").toUpperCase();
    const sapMessage = pickField(sapBody, "MESSAGE");
    const sapNumber = pickField(sapBody, "NUMBER");
    const isExplicitError = statusStr === "ERROR" || statusStr === "FAIL" || statusStr === "FAILURE" || statusStr === "FALSE" || statusStr === "E";
    const isExplicitSuccess = statusStr === "SUCCESS" || statusStr === "TRUE" || statusStr === "S" || statusStr === "OK";
    const success = result.ok && !isExplicitError && (isExplicitSuccess || statusStr === "");

    let dbError: string | null = null;
    if (success) {
      const { error: updErr } = await supabaseAdmin.from("custom_roles").update({
        name: data.name,
        description: data.description || null,
        tenant_id: data.tenant_id || null,
        is_active: data.is_active,
      }).eq("id", data.role_id);
      if (updErr) {
        dbError = updErr.message;
      } else {
        const { data: existingPerms } = await supabaseAdmin
          .from("role_permissions")
          .select("screen_key, action, allowed")
          .eq("custom_role_id", data.role_id);
        const existingAllowed = new Map(
          (existingPerms ?? []).map((p: any) => [`${p.screen_key}:${p.action}`, Boolean(p.allowed)]),
        );
        await supabaseAdmin.from("role_permissions").delete().eq("custom_role_id", data.role_id);
        const permRows = uniqueScreens.flatMap((k) =>
          PERMISSION_ACTIONS.map((action) => ({
            custom_role_id: data.role_id,
            screen_key: k,
            action,
            allowed: existingAllowed.get(`${k}:${action}`) ?? true,
          })),
        );
        const { error: permErr } = await supabaseAdmin.from("role_permissions").insert(permRows);
        if (permErr) dbError = permErr.message;
      }
    }

    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: "user.sap_role_edit",
      target_table: "custom_roles",
      target_id: data.role_id,
      payload: {
        request: payload.EDIT,
        screen_keys: uniqueScreens,
        response: sapBody,
        middleware_status: result.status,
        middleware_error: result.error ?? null,
        success,
        db_error: dbError,
      },
    });

    if (!success) {
      const msg = sapMessage || result.error || `SAP rejected the request (status ${result.status})`;
      throw new Error(String(msg));
    }

    return {
      ok: true,
      message: String(sapMessage ?? `Role ${payload.EDIT.ROLE} updated successfully`),
      number: sapNumber ?? null,
      db_error: dbError,
    };
  });
