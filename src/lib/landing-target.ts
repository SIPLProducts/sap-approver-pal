/**
 * Resolves where a signed-in user should land, based on the screens their
 * active role grants. Purely a routing helper — no permission logic changes.
 */
export type LandingTarget = { to: string; params?: Record<string, string> };

export function resolveLandingTarget(can: (screen: string) => boolean): LandingTarget {
  if (can("approvals.inbox.mm")) return { to: "/inbox/$module", params: { module: "mm" } };
  if (can("approvals.inbox.sd") || can("sd.dashboard")) return { to: "/sd/dashboard" };
  const sd: [string, string][] = [["sd.price","/sd/price"],["sd.contract","/sd/contract"],["sd.sc_so","/sd/sc-so"],["sd.sales_order","/sd/sales-order"],["sd.bmw_status","/sd/bmw-status"]];
  for (const [k, to] of sd) if (can(k)) return { to };
  if (can("mm.dashboard")) return { to: "/mm/dashboard" };
  if (can("approvals.history")) return { to: "/history" };
  if (can("admin.users")) return { to: "/admin/users" };
  return { to: "/settings" };
}
