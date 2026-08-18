/**
 * Resolves where a signed-in user should land, based on the screens their
 * active role grants. Purely a routing helper — no permission logic changes.
 */
export type LandingTarget = { to: string; params?: Record<string, string> };

export function resolveLandingTarget(can: (screen: string) => boolean): LandingTarget {
  if (can("approvals.inbox.mm")) return { to: "/inbox/$module", params: { module: "mm" } };
  if (can("approvals.inbox.sd")) return { to: "/sd/dashboard" };
  if (can("approvals.history")) return { to: "/history" };
  if (can("admin.users")) return { to: "/admin/users" };
  return { to: "/settings" };
}
