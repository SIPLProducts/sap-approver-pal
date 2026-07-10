# Fix "Forbidden: admin role required" on Save

## Cause
`src/lib/admin/email-config.functions.ts` uses a local `assertAdmin` helper that calls `ctx.supabase.rpc("has_role", ...)` as the signed-in user. An earlier migration revoked `EXECUTE` on `public.has_role` from `authenticated`, so this RPC never succeeds — even for real admins — and every save/load/test call throws `Forbidden: admin role required`.

The rest of the admin screens use `assertScreen(userId, key)` from `src/lib/admin/assert-screen.ts`, which runs through the service-role client and correctly handles both:
- built-in `Admin` role in `user_roles`
- SAP-activity-based access cached on `profiles.sap_profile`

## Change (single file)

`src/lib/admin/email-config.functions.ts`:
- Remove the local `assertAdmin` helper.
- Import `assertScreen` from `@/lib/admin/assert-screen`.
- In each of the three server functions (`getNoReplyEmailConfig`, `saveNoReplyEmailConfig`, `sendNoReplyTestEmail`) replace `await assertAdmin(context)` with `await assertScreen(context.userId, "settings.email_config")` — matching the screen key already used by the UI (`perms.can("settings.email_config")`).

No DB, UI, or forgot-password logic changes.

## Verification
- Reload `/email-config` as the `9898 ADMIN` user → fields load.
- Click Save Configuration → success toast, values persist after reload.
- Click Send Test Email → email sent using saved SMTP.
