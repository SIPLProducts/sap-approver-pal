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

    let matched: { id: string; code: string }[] = [];
    let skipped: string[] = [];
    if (data.plants && data.plants.length > 0) {
      const codes = Array.from(new Set(data.plants.map((c) => c.trim()).filter(Boolean)));
      const { data: tRows } = await supabaseAdmin
        .from("tenants").select("id, code").in("code", codes);
      matched = (tRows ?? []) as { id: string; code: string }[];
      const found = new Set(matched.map((t) => t.code));
      skipped = codes.filter((c) => !found.has(c));
      if (matched.length > 0) {
        const rows = matched.map((t, i) => ({
          user_id: newId, tenant_id: t.id, is_default: i === 0,
        }));
        await supabaseAdmin.from("user_tenants").insert(rows);
      }
    }

    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id: context.userId, action: "user.invite", target_table: "auth.users", target_id: newId,
      payload: { email: data.email, role: data.role, plants: data.plants ?? [], skipped_plants: skipped },
    });
    return { user_id: newId, plants_added: matched.length, plants_skipped: skipped };
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
