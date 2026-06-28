import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveContext } from "@/hooks/use-active-context";
import type { AppRole } from "@/lib/approvals/constants";
import type { PermissionAction } from "@/lib/admin/screen-keys";

type PermKey = string;

export type UsePermissions = {
  loading: boolean;
  ready: boolean;
  isAdmin: boolean;
  activeRoleLabel: string | null;
  allowedScreens: Set<string>;
  can: (screen: string, action?: PermissionAction) => boolean;
};

export function usePermissions(): UsePermissions {
  const { user, loading: authLoading } = useAuth();
  const { activeRole, roles: assignedRoles, loading: ctxLoading } = useActiveContext();

  const isAdmin =
    activeRole?.kind === "built_in" && (activeRole.value as AppRole) === ("Admin" as AppRole);

  const { data: perms, isLoading: permsLoading } = useQuery({
    queryKey: ["perm-active-role", user?.id, activeRole?.kind, activeRole?.value],
    enabled: !!user && !!activeRole && !isAdmin,
    staleTime: 60_000,
    queryFn: async () => {
      if (!activeRole) return [] as { screen_key: string; action: string }[];
      let q = supabase.from("role_permissions").select("screen_key, action").eq("allowed", true);
      if (activeRole.kind === "built_in") q = q.eq("built_in_role", activeRole.value);
      else q = q.eq("custom_role_id", activeRole.value);
      const { data } = await q;
      return (data ?? []) as { screen_key: string; action: string }[];
    },
  });

  const loading = authLoading || ctxLoading || (!isAdmin && !!activeRole && permsLoading);
  const ready = !loading && !!user;

  const { allowedScreens, permSet } = useMemo(() => {
    const screens = new Set<string>();
    const set = new Set<PermKey>();
    if (isAdmin) return { allowedScreens: screens, permSet: set };
    for (const p of perms ?? []) {
      if (!p?.screen_key) continue;
      screens.add(p.screen_key);
      set.add(`${p.screen_key}:${p.action}`);
    }
    return { allowedScreens: screens, permSet: set };
  }, [perms, isAdmin]);

  function can(screen: string, action: PermissionAction = "view") {
    if (isAdmin) return true;
    if (!activeRole) return false;
    return permSet.has(`${screen}:${action}`) || (action === "view" && allowedScreens.has(screen));
  }

  const activeRoleLabel = activeRole
    ? activeRole.kind === "built_in"
      ? activeRole.value
      : assignedRoles.find((r) => r.kind === "custom" && r.value === activeRole.value)?.label ?? "Custom"
    : null;

  return { loading, ready, isAdmin, activeRoleLabel, allowedScreens, can };
}
