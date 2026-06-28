## Goal
Add Plant and Role dropdowns to the top header bar. Each shows only what's assigned to the logged-in user. Plant filters approval/inbox/history queries; Role gates which screens are visible (one active role at a time).

## Data sources (no schema changes)
- Plants → `user_tenants` joined to `tenants` (already populated by admin user-mgmt).
- Built-in roles → `user_roles.role`.
- Custom roles → `user_custom_roles` joined to `custom_roles` (id, name).
- Permissions → `role_permissions` filtered to the single active role.

## Plan

### 1. Active context provider — `src/hooks/use-active-context.tsx`
New React context + provider that holds `{ activePlant, activeRole }` where `activeRole` is `{ kind: "built_in" | "custom", value: string }`. Loads from `localStorage` (keys `app.activePlant`, `app.activeRole`) on mount; falls back to the user's first assigned plant / first role. Persists changes back to `localStorage`. Mounted inside `_authenticated` layout so it's available to all protected screens.

### 2. Queries for the user's assignments — extend `usePermissions` or new `useMyAssignments`
- New hook `useMyAssignments()` returns:
  - `plants: { code, name }[]` from `user_tenants → tenants` where `user_id = auth.uid()`.
  - `roles: { kind, value, label }[]` — union of built-in (`user_roles`) and custom (`user_custom_roles → custom_roles`).
- Cached via React Query with `staleTime: 60_000`.

### 3. Rework `usePermissions` to honor the *active* role
- Accept active role from context (or read it internally from the provider).
- Replace the current "union of all roles" query with a single-role query: fetch `role_permissions` matching only the active role (`built_in_role = X` OR `custom_role_id = Y`).
- `isAdmin` becomes true only when active role is built-in `Admin`. Sidebar/route gating then reflects what the active role can see — switching roles updates the visible screens immediately.

### 4. Top-bar UI — edit `src/routes/_authenticated.tsx`
- Wrap `AuthenticatedLayout` content in `<ActiveContextProvider>`.
- In the header (before the Sync SAP button), render two compact shadcn `<Select>` controls:
  - Plant: options = `assignments.plants` (label `code — name`), placeholder "Select plant". Hidden if user has 0 plants.
  - Role: options = `assignments.roles` (label = role name + small `Built-in`/`Custom` tag), hidden if user has ≤1 role *and* showing it adds no value (still show single-role as read-only badge for clarity).
- Selecting either updates context → triggers re-render of sidebar (gated by `usePermissions`) and refetch of plant-scoped queries.

### 5. Plant filter wiring
- Read `activePlant` in queries that already accept a plant filter. Concretely, pass it into the existing query keys / args for:
  - `src/routes/_authenticated/inbox.$module.tsx` (MM and SD inbox lists)
  - `src/routes/_authenticated/history.tsx`
  - `src/routes/_authenticated/sd.price.tsx`, `sd.contract.tsx`, `sd.sc-so.tsx`, `sd.sales-order.tsx` (these already use `PlantSelect`; switch their internal plant state to default from `activePlant` and stay in sync when it changes; keep the inline `PlantSelect` so users can still override per-screen, or remove it — see "Open question" below).
- The plant value sent to server fns is the tenant `code` (e.g. `3601`), matching the existing SAP `WERKS/VKORG` usage.

### 6. Sidebar/route gating already in place
- `usePermissions` is already consumed in `src/routes/_authenticated.tsx` to filter sidebar entries. Once it switches to the active-role-only mode, no further sidebar code changes are needed.
- If the user switches to a role that doesn't include the current route's screen, redirect to the first allowed screen (reuse logic from `src/routes/index.tsx`).

### 7. Files touched
- New: `src/hooks/use-active-context.tsx`, `src/hooks/use-my-assignments.ts`
- Edit: `src/hooks/use-permissions.ts`, `src/routes/_authenticated.tsx`, `src/routes/index.tsx` (first-allowed-screen redirect helper), and the inbox/history/SD screens to read `activePlant`.

## Out of scope
- No DB schema changes; relies on existing `user_tenants`, `user_roles`, `user_custom_roles`, `role_permissions`.
- Per-screen `PlantSelect` keeps working; this just adds a global default.
- Action-level gating (create/edit) still flows through `can(screen, action)` unchanged.

## Open question (will default if not answered)
Should the per-screen `PlantSelect` on SD pages be removed in favor of only the header dropdown? Default: keep both — header sets the default, per-screen lets the user override for that view.
