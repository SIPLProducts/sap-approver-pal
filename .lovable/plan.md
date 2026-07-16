## Goal
Introduce an "MM Dashboard" sub-screen under "MM Approvals" in the sidebar, mirroring the SD Approvals → SD Dashboard pattern. The MM Dashboard shows the existing MM Approvals inbox screen. No existing business logic, server functions, or the inbox component are modified.

## Changes

### 1. New route: `src/routes/_authenticated/mm.dashboard.tsx`
- Registers `/mm/dashboard`.
- Uses `beforeLoad` to `redirect({ to: "/inbox/$module", params: { module: "mm" } })`, so the existing MM Approvals inbox (`inbox.$module.tsx`) renders unchanged.
- This keeps "MM Dashboard" as a distinct, permission-checkable sub-screen entry without duplicating or modifying the inbox implementation.

### 2. Sidebar update: `src/routes/_authenticated.tsx`
Convert the current single "MM Approvals" link into a collapsible group that mirrors the SD group:

- Add `mmOpen` / `mmExpanded` state parallel to `sdOpen` / `sdExpanded`:
  - `mmOpen = pathname.startsWith("/inbox/mm") || pathname.startsWith("/mm")`.
- Build an `mmChildren` array (same shape as `sdChildren`) with a single entry:
  - `{ to: "/mm/dashboard", label: "MM Dashboard", icon: LayoutDashboard (or BarChart3), screen: "approvals.inbox.mm" }`.
- Replace lines 196–202 (the flat MM link) with the same collapsible button + expanded child list markup used for SD (lines 204–250), gated on `showMm` and filtered by `can(screen)`.
- Clicking the "MM Approvals" parent expands the group and navigates to `/mm/dashboard` (which redirects into the existing inbox).

### 3. Permissions
- Uses existing screen key `approvals.inbox.mm` — no changes to `src/lib/admin/screen-keys.ts`.

## Not changed
- `src/routes/_authenticated/inbox.$module.tsx` (MM inbox rendering logic)
- Any server functions, SAP sync, notifications, or query keys
- `src/routes/index.tsx` marketing links to `/inbox/mm` (still valid)
- `screen-keys.ts` / permissions model
