
## 1. Default SD Approvals to SD Dashboard + auto-expand submenu

**File:** `src/routes/_authenticated.tsx`

- In the SD Approvals sidebar button `onClick`, change the target from `/sd/price` to `/sd/dashboard` so clicking the parent lands on the dashboard.
- `sdExpanded` already opens when `pathname.startsWith("/sd")`, so navigating to `/sd/dashboard` will auto-expand the submenu — no other logic change needed.
- Reorder the `sdChildren` array so `SD Dashboard` is listed first (it already is), and ensure the button click also calls `setSdExpanded(true)` (already does).

## 2. Speed up SD Dashboard load

The dashboard makes one heavy SAP call (`fetchBmwStatusReport`) whose latency dominates. Perceived speed will improve with these presentation/data-layer tweaks — no server logic changes.

**File:** `src/routes/_authenticated/sd.dashboard.tsx`

- Raise cache lifetime on the query: `staleTime: 5 * 60_000`, `gcTime: 30 * 60_000`, and `refetchOnWindowFocus: false`, `refetchOnMount: false` so revisits render instantly from cache.
- Add `placeholderData: (prev) => prev` (keepPreviousData) so switching plants shows the previous dataset immediately while the new one loads in the background (no full skeleton flash).
- Change the loading condition from `loading && rows.length === 0` (already good) but also render KPIs/charts from cached `rows` while `isFetching` is true, with a small inline "Refreshing…" indicator instead of the full-page skeleton.
- Wrap the heavy `stats` `useMemo` result unchanged (already memoized). No structural change.

**File:** `src/routes/_authenticated.tsx`

- Prefetch the dashboard query on SD Approvals button hover/focus (intent preload) using `queryClient.prefetchQuery` with the same `queryKey: ["sd-dashboard-bmw", from, to]` and same `queryFn`. This warms the cache before the user clicks.

**File:** `src/router.tsx` (verify only)

- Confirm `defaultPreload: "intent"` is set so `<Link>`s to `/sd/dashboard` also preload the route module. If missing, add it. (No other router changes.)

## Out of scope

- No SAP payload, server function, or backend changes.
- No visual redesign of the dashboard, KPI tiles, or charts.
- No changes to permissions, routing structure, or other SD screens.

## Verification

- Click SD Approvals in the sidebar → lands on `/sd/dashboard`, submenu expanded, Dashboard row highlighted.
- Navigate away and back within 5 min → dashboard renders instantly from cache.
- Change plant in top bar → previous data stays on screen while new data loads (no skeleton flash).
- Typecheck passes (`tsgo`).
