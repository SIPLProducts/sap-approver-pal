/**
 * Server-side authorization helper. Authorizes by SAP activities cached in
 * `profiles.sap_profile` at login, falling back to the built-in Supabase
 * `Admin` role so Google / dev admins keep working.
 */
import { activityToScreenKey } from "@/lib/admin/screen-keys";

type SapProfile = {
  plants?: Array<{
    roles?: Array<{ activities?: string[] }>;
  }>;
};

export async function assertScreen(userId: string, screenKey: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1. SAP-cached activities
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("sap_profile")
    .eq("id", userId)
    .maybeSingle();

  const sap = (profile?.sap_profile ?? null) as SapProfile | null;
  if (sap?.plants?.length) {
    for (const p of sap.plants) {
      for (const r of p.roles ?? []) {
        for (const act of r.activities ?? []) {
          if (activityToScreenKey(act) === screenKey) return;
        }
      }
    }
  }

  // 2. Fallback: built-in Admin role
  const { data: admin } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "Admin")
    .maybeSingle();
  if (admin) return;

  throw new Error("Not authorized for this screen");
}

/**
 * Allows access if the user has any of the given screen keys.
 * Used to keep the legacy `assertAdmin` call sites grouped by module.
 */
export async function assertAnyScreen(userId: string, screenKeys: string[]): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("sap_profile")
    .eq("id", userId)
    .maybeSingle();

  const sap = (profile?.sap_profile ?? null) as SapProfile | null;
  const wanted = new Set(screenKeys);
  if (sap?.plants?.length) {
    for (const p of sap.plants) {
      for (const r of p.roles ?? []) {
        for (const act of r.activities ?? []) {
          const key = activityToScreenKey(act);
          if (key && wanted.has(key)) return;
        }
      }
    }
  }

  const { data: admin } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "Admin")
    .maybeSingle();
  if (admin) return;

  throw new Error("Not authorized for this screen");
}
