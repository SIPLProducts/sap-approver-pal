import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { AppRole } from "@/lib/approvals/constants";
import type { PermissionAction } from "@/lib/admin/screen-keys";

type PermKey = string; // `${screen}:${action}`

export type UsePermissions = {
  loading: boolean;
  ready: boolean;
  roles: AppRole[];
  customRoleIds: string[];
  isAdmin: boolean;
  allowedScreens: Set<string>;
  can: (screen: string, action?: PermissionAction) => boolean;
};

export function usePermissions(): UsePermissions {
  const { user, loading: authLoading } = useAuth();

  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ["perm-roles", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      return ((data ?? []).map((r: any) => r.role as AppRole)) ?? [];
    },
  });

  const { data: customRoleIds, isLoading: customLoading } = useQuery({
    queryKey: ["perm-custom-roles", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_custom_roles")
        .select("custom_role_id")
        .eq("user_id", user!.id);
      return ((data ?? []).map((r: any) => r.custom_role_id as string)) ?? [];
    },
  });

  const isAdmin = !!roles?.includes("Admin" as AppRole);

  const { data: perms, isLoading: permsLoading } = useQuery({
    queryKey: ["perm-perms", user?.id, roles, customRoleIds, isAdmin],
    enabled: !!user && !!roles && !!customRoleIds && !isAdmin,
    staleTime: 60_000,
    queryFn: async () => {
      const built = roles ?? [];
      const cust = customRoleIds ?? [];
      if (built.length === 0 && cust.length === 0) return [] as { screen_key: string; action: string }[];
      let q = supabase
        .from("role_permissions")
        .select("screen_key, action, built_in_role, custom_role_id")
        .eq("allowed", true);
      // OR filter
      const orParts: string[] = [];
      if (built.length) orParts.push(`built_in_role.in.(${built.join(",")})`);
      if (cust.length) orParts.push(`custom_role_id.in.(${cust.join(",")})`);
      if (orParts.length) q = q.or(orParts.join(","));
      const { data } = await q;
      return (data ?? []) as { screen_key: string; action: string }[];
    },
  });

  const loading =
    authLoading || rolesLoading || customLoading || (!isAdmin && permsLoading);
  const ready = !loading && !!user;

  const { allowedScreens, permSet } = useMemo(() => {
    const screens = new Set<string>();
    const set = new Set<PermKey>();
    if (isAdmin) {
      return { allowedScreens: screens, permSet: set, all: true };
    }
    for (const p of perms ?? []) {
      if (!p?.screen_key) continue;
      screens.add(p.screen_key);
      set.add(`${p.screen_key}:${p.action}`);
    }
    return { allowedScreens: screens, permSet: set, all: false };
  }, [perms, isAdmin]);

  function can(screen: string, action: PermissionAction = "view") {
    if (isAdmin) return true;
    return permSet.has(`${screen}:${action}`) || (action === "view" && allowedScreens.has(screen));
  }

  return {
    loading,
    ready,
    roles: roles ?? [],
    customRoleIds: customRoleIds ?? [],
    isAdmin,
    allowedScreens,
    can,
  };
}
