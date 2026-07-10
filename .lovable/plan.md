## Treat Email Configuration like every other permissioned screen

### Goal

Drop the special-case admin gate on Email Configuration. Access is governed purely by the `settings.email_config` screen permission (the SAP `SETTINGS.EMAIL_CONFIG` activity), exactly like `admin.users`, `sap.api_settings`, etc.

Whoever gets the screen assigned via Roles → Screen Permissions can open it. Whoever doesn't, can't. No hard-coded "Admin only" branch anywhere.

### Changes

1. **`src/routes/_authenticated.tsx`**
   - Remove the second, `adminOnly` Email Configuration entry in `manage_items` (the duplicate at line 164).
   - Simplify the `manage_items.filter(...)` back to the standard `it.screen === null || can(it.screen)` — drop the `adminOnly` / `isBuiltinAdmin || isSapAdmin` branch.
   - Remove the now-unused `useIsBuiltInAdmin` import + call and the `isSapAdmin` local if nothing else uses them.

2. **`src/routes/_authenticated/email-config.tsx`**
   - Replace the `useIsBuiltInAdmin` + `isSapAdmin` gate with the same pattern other permissioned screens use: check `perms.can("settings.email_config")`.
   - Loading state waits on `perms.loading` only.
   - If not permitted, keep the existing "Not authorized" alert.
   - Remove `useIsBuiltInAdmin` import.

### Not changing

- `screen-keys.ts` — `settings.email_config` / `SETTINGS.EMAIL_CONFIG` stays as-is (already in Roles → Screen Permissions from the earlier change).
- Server-side assertions, DB, migrations.
- Page UI/copy/design.
- Any other screen's gating logic.

### Result

Admins retain access only if their role has the Email Configuration screen assigned (as with any other screen). To grant a non-admin, an admin simply ticks Email Configuration in Roles → Screen Permissions for that role — no code change needed.
