## Restrict Email Configuration to Admin only (for now)

Currently the sidebar entry is gated by `settings.email_config`, so any custom role granted that screen would see it. To keep it Admin-only until we're ready to expose it:

### Changes

1. **`src/routes/_authenticated.tsx`** — replace the screen-based gate on the Email Configuration nav item with a built-in Admin check:
   - Import the existing `useIsBuiltinAdmin` hook (`src/hooks/use-is-builtin-admin.ts`).
   - Filter the Email Configuration item out unless `isBuiltinAdmin === true`.
   - Leave the entry visually/positionally unchanged otherwise.

2. **`src/routes/_authenticated/email-config.tsx`** — add a lightweight component-level guard:
   - If `!isBuiltinAdmin`, render a simple "Not authorized" message (same pattern used elsewhere) instead of the form, so direct URL access is also blocked.

3. **`src/lib/admin/screen-keys.ts`** — leave the `settings.email_config` entry in place so it still shows in the Roles tab chip list (per the previous request), but it will have no effect until we drop the Admin-only gate. No change here.

### Notes

- No DB / migration changes.
- No visual/style changes.
- When we're ready to open the screen to custom roles, we simply revert step 1 back to `screen: "settings.email_config"` and remove the guard in step 2.
