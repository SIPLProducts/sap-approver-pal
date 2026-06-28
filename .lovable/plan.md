## Goal

Two real defects to fix, both rooted in the active-role plumbing:

1. **Role switch in top bar requires a page reload** to update the sidebar / screen permissions.
2. **On Admin-style roles all screens are visible, but Save / Edit buttons silently do nothing** (no toast, no navigation).

Both are fixed without hardcoding role names — gating stays driven by SAP `ACTIVITIES` and the screen-key map.

---

## Root causes

### A. Role switch needs reload

`useSapProfile()` reads `localStorage` once into `useState`. When the top-bar role changes, `activeRole` state updates but the *consumers downstream that re-derive permissions* aren't all observing the same source — in particular nothing tells TanStack Router / Query that the gating inputs changed. Combined with the "repair role" effect in `use-active-context.tsx` racing against the user's selection, the sidebar `can(...)` results stay computed from the previous role until a hard reload re-seeds `activeRole` from `localStorage`.

### B. Edit/Save does nothing on Admin screens

Two compounding issues:

1. `usePermissions.isAdmin` is computed as `allowedScreens.has("admin.users") && allowedScreens.has("admin.role_permissions")` — a *conjunction*. Any built-in or custom SAP role that lacks one of those two activities is treated as "not admin", so `can(screen, "edit"|"create"|"delete")` (currently `if (isAdmin) return true; else view-only check`) yields no privileged actions.
2. Server functions (`assertAnyScreen`) read `profiles.sap_profile`. Sessions established **before** the migration that added the `sap_profile` column have a null value — server falls back to the `user_roles = 'Admin'` row, which SAP-only users do not have, so every privileged call throws `Not authorized for this screen`. The thrown error is consumed by query handlers, so the button appears to "do nothing".

---

## Changes

### 1. Reliable active-context propagation (`src/hooks/use-sap-profile.ts`, `src/hooks/use-active-context.tsx`)

- Rewrite `useSapProfile` with `useSyncExternalStore` subscribing to the existing `sap-profile-changed` event + `storage` event. All consumers will share a single, always-fresh snapshot.
- In `ActiveContextProvider`:
  - Tighten the "repair role" effect so it only fires when `activeRole` is *missing or no longer in the list*, never when the user has just selected a valid one. Track a `userInteracted` ref or compare by value before overwriting.
  - Expose a stable `activeRoleKey` (`${plant}:${role}`) so consumers (router/query keys) can re-key on switch.
- In `_authenticated.tsx` `onRoleChange`: after `setActiveRole`, also call `router.invalidate()` so any route-level loader gated by the active role re-runs. Keep `queryClient.invalidateQueries()`.

### 2. Action-aware permission check that matches SAP's model (`src/hooks/use-permissions.ts`, `src/lib/admin/screen-keys.ts`)

SAP returns one ACTIVITY per screen with no separate edit/delete activity, so the truthful rule is: **if the active role grants the screen, every action on that screen is allowed**. Implement:

- Remove the `isAdmin` conjunction gate from `can(...)`. `can(screen, action)` becomes `allowedScreens.has(screen)` — action is recorded for future use but does not narrow access.
- Keep `isAdmin` as a *derived convenience flag* (true when the role grants any `ADMIN.*` activity), used only for cosmetic things like the "Admin" badge in the sidebar — never as a gate for buttons.
- No new screen keys; SAP `ACTIVITIES` payload remains the source of truth.

### 3. Self-healing SAP profile on the server (`src/lib/auth/sap-login.functions.ts`, `src/lib/admin/assert-screen.ts`)

- On every successful `verifyOtp` / SAP login, upsert the latest `sap_profile` to `profiles` (already done) — additionally write `sap_profile_updated_at` so we can tell freshness.
- In `assertScreen` / `assertAnyScreen`: when `profiles.sap_profile` is null, attempt one fallback fetch using the bearer token's SAP user id by calling the SAP `LOGIN` endpoint with the cached credentials path *only if available*; otherwise return a clear error message ("Please sign out and sign in again to refresh your SAP permissions") that the UI can surface.
- Update toast handling on admin pages: wrap `useServerFn` calls so thrown errors always raise a `toast.error(message)` instead of being swallowed.

### 4. Verify the fix end-to-end

- After implementing, exercise via Playwright against the running preview: log in as `SARVI_INFO1` / `12345678`, switch role in top bar, and confirm sidebar items change without reload; open Users & Roles, edit a custom role, click Save, and confirm either success toast or a clear authorization toast.

---

## Files touched

- `src/hooks/use-sap-profile.ts` — `useSyncExternalStore`-based snapshot.
- `src/hooks/use-active-context.tsx` — non-clobbering repair, expose `activeRoleKey`, no behavior change for plant logic.
- `src/hooks/use-permissions.ts` — `can()` no longer narrows by action; `isAdmin` derived from any `ADMIN.*` activity (cosmetic only).
- `src/routes/_authenticated.tsx` — `onRoleChange` calls `router.invalidate()` in addition to query invalidation; remove any leftover `isAdmin` UI gates.
- `src/lib/auth/sap-login.functions.ts` — also write `sap_profile_updated_at`.
- `src/lib/admin/assert-screen.ts` — clearer error message when `sap_profile` is null, no Admin-role hardcoding beyond the existing safety fallback.
- Admin pages with Save buttons (`admin.users.tsx`, `admin.strategies.tsx`, `admin.sap-api.*`, `admin.integrations.tsx`) — ensure server-fn errors surface via `toast.error`.

No DB migration is needed beyond the optional `sap_profile_updated_at` timestamp; if added, it goes in one migration with appropriate `GRANT` review (column add only, no policy change).