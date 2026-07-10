## Fix "Not authorized" on Email Configuration for SAP ADMIN users

### Problem

The signed-in user (SARVI_INFO1) has the SAP role **ADMIN** — visible in the sidebar badge — but no row in the Supabase `user_roles` table with the built-in `Admin` role. The current guard uses `useIsBuiltInAdmin()`, which only checks `user_roles` via the `has_role` RPC, so SAP-only admins get "You are not authorized to view this screen." even though they are effectively admins.

The sidebar item is hidden for the same reason, so this user reaches the page only via the saved URL / browser history.

### Fix

Broaden the "admin" check used by the Email Configuration screen and its sidebar entry to accept **either**:

1. The built-in Supabase `Admin` role (current behavior), **or**
2. An active SAP role whose label is `ADMIN` (case-insensitive) — matches what SAP returns and what the sidebar badge already shows.

### Changes

1. **`src/routes/_authenticated/email-config.tsx`**
   - In addition to `useIsBuiltInAdmin()`, read `usePermissions()` and derive `isSapAdmin = activeRoleLabel?.trim().toUpperCase() === "ADMIN"`.
   - Wait for both `adminLoading` and `perms.loading` before deciding.
   - Allow the page if `isBuiltinAdmin || isSapAdmin`; otherwise keep the existing "Not authorized" alert.

2. **`src/routes/_authenticated.tsx`**
   - Compute the same `isSapAdmin` from `perms.activeRoleLabel`.
   - In the `manage_items` filter, change the Email Configuration entry's gate from `isBuiltinAdmin` to `isBuiltinAdmin || isSapAdmin` so the sidebar link reappears for SAP admins.

### Not changing

- `screen-keys.ts` (Email Configuration stays in the chip list).
- Any DB / migration / server assertions.
- Visual design or copy of the screen.
- The existing duplicate Email Configuration entry in `manage_items` (one gated by `settings.email_config` screen, one adminOnly) is left as-is per prior direction; only the adminOnly gate is broadened.
