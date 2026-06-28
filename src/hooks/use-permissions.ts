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

  // Cosmetic flag only — derived from any ADMIN.* activity granted by the
  // active role. Never use this as a gate; use `can(screen, action)` instead.
  const isAdmin = useMemo(
    () => activeActivities.some((a) => a.trim().toUpperCase().startsWith("ADMIN.")),
    [activeActivities],
  );

  const loading = authLoading || ctxLoading;
  const ready = !loading && !!user;

  // SAP returns a single ACTIVITY per screen with no separate
  // view/edit/delete activity. If the active role grants the screen, every
  // action on that screen is allowed.
  function can(screen: string, _action: PermissionAction = "view") {
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
