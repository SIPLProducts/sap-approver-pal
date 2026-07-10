
## 1. UI — `src/routes/_authenticated/email-config.tsx`
- Delete the `Tabs` wrapper and the disabled `User SMTP Configuration` trigger. Render the No-Reply panel directly.
- Update page subtitle/description to drop the "user SMTP" wording.
- Wire the form to a server function:
  - On mount, load persisted config and hydrate all fields (host, port, encryption, username, from email, from name, cc list, enabled toggle). App password field stays empty when a value already exists (kept as "leave empty to keep existing").
  - `Save Configuration` calls `saveNoReplyEmailConfig` server fn (upsert; leaves password unchanged when the field is empty).
  - `Send Test Email` calls `sendNoReplyTestEmail` server fn using saved config.

## 2. Storage (new migration)
- `public.email_no_reply_config` (single row, id text pk default `'default'`):
  - `enabled bool not null default true`
  - `host text`, `port int`, `encryption text` (`none|ssl|tls|starttls`)
  - `username text`, `from_email text`, `from_name text`
  - `cc_recipients text[] not null default '{}'`
  - `updated_at timestamptz`, `updated_by uuid`
- `public.email_no_reply_secrets` (id text pk `'default'`, `app_password text`). No RLS grants to `authenticated`/`anon`; accessed only via service-role server code.
- `email_no_reply_config` grants: `SELECT/INSERT/UPDATE` to `authenticated` guarded by RLS requiring `has_role(auth.uid(),'Admin')`; `ALL` to `service_role`. Never expose `app_password` to the client.
- Trigger `touch_updated_at` on config table.

## 3. Server functions — `src/lib/admin/email-config.functions.ts` (new)
- `getNoReplyEmailConfig` (auth, admin only) → returns config row + `hasPassword: boolean` (never the password itself).
- `saveNoReplyEmailConfig` (auth, admin only) → upserts config; if payload includes non-empty `app_password`, upsert into secrets table; otherwise leave existing password intact.
- `sendNoReplyTestEmail` (auth, admin only) → sends a simple test email via SMTP using saved config.

## 4. Forgot Password wiring — `src/lib/auth/sap-forgot.functions.ts`
- Before building the SAP payload, load the No-Reply config (`from_email`, `from_name`, `enabled`).
- If enabled and `from_email` present, include the sender in the SAP payload as
  `FORGOT: { EMAIL, FROM_EMAIL, FROM_NAME }` so SAP uses it as the "from" when it dispatches the reset mail. If disabled or no from configured, return an error `"No-Reply sender is not configured"` and skip the SAP call.
- No SMTP send from the app for Forgot (per user: "just trigger the mail, from mail is in the email configuration").
- Sync-log message updated to include which sender was used.

## 5. SMTP dependency
- Add `nodemailer` (and `@types/nodemailer`) for the `sendNoReplyTestEmail` path only. Import inside the handler to keep it out of client bundles.

## Non-technical summary
- The Email Configuration screen shows only the No-Reply tab now.
- No-Reply settings (SMTP host/port/user/password/from/CC) are saved to the database. The password is stored securely and never sent back to the browser; leaving it empty on save keeps the existing one.
- A "Send Test Email" button verifies the settings actually work.
- The Forgot Password link on the login screen tells SAP to send the reset email using the From address configured here.

## Out of scope
- No changes to login UI, permissions model, SAP API Settings, or other screens.
