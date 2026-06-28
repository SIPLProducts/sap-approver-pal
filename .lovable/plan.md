## Problem

Two related bugs caused by an activity↔screen-key mismatch and a stale admin gate.

### 1. Permissions don't match the active SAP role

`usePermissions` turns each SAP activity into a screen key by lowercasing it:

```
"APPROVALS.INBOX_MM"  ->  "approvals.inbox_mm"   (SAP-style, underscores)
"APPROVALS.INBOX.MM"  ->  "approvals.inbox.mm"   (app screen key, dots)
```

The sidebar / `can()` use the app keys from `SCREEN_GROUPS` (e.g. `approvals.inbox.mm`, `admin.users`), while SAP returns activities in its own naming. Where the two happen to coincide, the screen shows. Where they differ, the user is either denied a screen they should see or shown a screen they shouldn't — exactly the symptom on RESL_ADMIN.

There is also no shared source of truth: the "Create custom role" dialog sends `ACTIVITY = screen_key.toUpperCase()` to SAP while `usePermissions` reads it back through the lowercase rule, so custom roles created in the app and built-in SAP roles use two different conventions.

### 2. "Failed to load users — Admin only"

`listUsersViaSap` (and every other server function in `user-mgmt.functions.ts`, `sap-api.functions.ts`, `sap-global.functions.ts`, `integrations.functions.ts`) calls `assertAdmin(context.userId)`, which checks the Supabase `user_roles` table for `role = 'Admin'`. SAP-only users have no row there, so the call rejects with `Admin only` even when their SAP role grants `ADMIN.USERS`.

## Fix

### A. One source of truth for screens ↔ activities

Extend `src/lib/admin/screen-keys.ts` so every entry in `SCREEN_GROUPS` declares its SAP activity code, and add helpers:

```ts
// pseudo-shape
{ key: "approvals.inbox.mm",  label: "MM Approvals Inbox", activity: "APPROVALS.INBOX_MM" }
{ key: "admin.users",         label: "Users & Roles",      activity: "ADMIN.USERS" }
// ...one row per screen
```

Helpers:
- `activityToScreenKey(activity)` — uses the table, no string munging.
- `screenKeyToActivity(key)` — used when creating/editing custom roles.
- `ALL_ACTIVITIES` — used to translate the active role's `ACTIVITIES[]` into `allowedScreens`.

The full activity list is taken from the SAP login payload the user pasted (`ADMIN.APPROVAL_MATRIX`, `ADMIN.USERS`, `APPROVALS.DETAIL`, `APPROVALS.HISTORY`, `APPROVALS.INBOX_MM`, `APPROVALS.INBOX_SD`, `ADMIN.ROLE_PERMISSIONS`, `ADMIN.CUSTOM_ROLES`, `ADMIN.STRATEGIES`, `SAP.API_SETTINGS`, `SAP.INTEGRATIONS`, `SAP.SYNC_LOG`, `REPORTS.AUDIT`, `REPORTS.NOTIFICATIONS`). The mapping is data, not hardcoded per role — every role's permissions still come from SAP.

Update sites:
- `src/hooks/use-permissions.ts` — build `allowedScreens` via `activityToScreenKey`; drop the lowercase rule. `isAdmin` stays derived (has `admin.users` AND `admin.role_permissions`).
- `src/lib/admin/user-mgmt.functions.ts` — `createCustomRoleViaSap` / `editCustomRoleViaSap` send `ACTIVITY: screenKeyToActivity(k)` and `RELEASE_CODE: ""` (already done).
- Role-permissions UI — when reading existing custom roles back, normalize via `activityToScreenKey` so the chips match.

### B. Server-side gate driven by SAP activities, not Supabase `Admin`

1. At login, persist the SAP profile server-side so server functions can authorize without trusting the client.
   - Add `profiles.sap_profile JSONB` (single column, full profile blob) via migration.
   - `sapLogin` (server fn) writes `sap_profile` for the matched Supabase user after the SAP handshake succeeds.

2. Replace `assertAdmin` with `assertScreen(userId, screenKey)`:
   - Reads `profiles.sap_profile`, flattens all activities across all plants/roles, maps to screen keys, and checks membership.
   - Falls back to the existing `user_roles.Admin` check so Google/dev admins keep working.

3. Apply per call site (no broad relaxation):
   - `listUsersViaSap`, `listRolesForPlants` → `assertScreen(uid, "admin.users")`
   - `createUserViaSap`, `createUser`, `inviteUser`, `deleteUser`, `setBuiltInRole`, `editUserViaSap` → `assertScreen(uid, "admin.users")`
   - `createCustomRoleViaSap`, `editCustomRoleViaSap` → `assertScreen(uid, "admin.custom_roles")` (or `admin.role_permissions`)
   - `sap-api.functions.ts` → `assertScreen(uid, "sap.api_settings")`
   - `integrations.functions.ts` → `assertScreen(uid, "sap.integrations")`
   - `sap-global.functions.ts` → keep `Admin`-only (global config) but also accept `admin.role_permissions`.

### C. Verify

- Sign in as `SARVI_INFO1` (RESL_ADMIN): every checked screen in the "11 of 14" dialog should appear; SAP API Settings / Integrations / Sync Log should not.
- Open `/admin/users`: table loads via `listUsersViaSap` with no "Admin only".
- Switch to a non-admin role: sidebar collapses to that role's screens only.
- Create a new custom role with a subset of screens, sign in as that role: only those screens render.

## Files

- `src/lib/admin/screen-keys.ts` — add `activity` per screen + helpers
- `src/hooks/use-permissions.ts` — use `activityToScreenKey`
- `src/lib/admin/user-mgmt.functions.ts` — `assertScreen`, send mapped activity on create/edit role
- `src/lib/admin/sap-api.functions.ts`, `integrations.functions.ts`, `sap-global.functions.ts` — `assertScreen`
- `src/lib/auth/sap-login.functions.ts` — persist `sap_profile` to `profiles`
- `src/routes/_authenticated/admin.users.tsx` — translate role activities → screen keys when displaying existing custom roles
- New migration: add `profiles.sap_profile JSONB`

No new tables, no hardcoded role lists. Screen visibility and server authorization both come from the SAP activities returned by `Login_API`.
