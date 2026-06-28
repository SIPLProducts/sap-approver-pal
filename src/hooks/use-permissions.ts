import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useActiveContext } from "@/hooks/use-active-context";
import { activityToScreenKey, type PermissionAction } from "@/lib/admin/screen-keys";

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
  const { activeRole, activeActivities, loading: ctxLoading } = useActiveContext();

  const allowedScreens = useMemo(() => {
    const s = new Set<string>();
    for (const a of activeActivities) {
      const key = activityToScreenKey(a);
      if (key) s.add(key);
    }
    return s;
  }, [activeActivities]);

  const isAdmin = useMemo(
    () => allowedScreens.has("admin.users") && allowedScreens.has("admin.role_permissions"),
    [allowedScreens],
  );

  const loading = authLoading || ctxLoading;
  const ready = !loading && !!user;

  function can(screen: string, _action: PermissionAction = "view") {
    if (isAdmin) return true;
    return allowedScreens.has(screen);
  }

  return {
    loading,
    ready,
    isAdmin,
    activeRoleLabel: activeRole?.label ?? null,
    allowedScreens,
    can,
  };
}
