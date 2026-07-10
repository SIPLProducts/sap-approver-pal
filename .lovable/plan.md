# Forgot Password: send credentials email via No-Reply SMTP

## Goal
After the SAP `Forgot_API` call returns, extract `ZMAIL`, `ZUSER`, `ZPASSWORD`, and `ZSTATUS` from the response, then send a professional HTML email to `ZMAIL` with those credentials, using the SMTP settings saved in the No-Reply Email Configuration screen.

## Change scope — one file
`src/lib/auth/sap-forgot.functions.ts` only. No UI, DB, or schema changes; the login page keeps calling `sapForgot` and showing the same toasts.

## Behavior

1. Call the SAP `Forgot_API` exactly as today (middleware path if configured, otherwise direct), with payload `{ FORGOT: { EMAIL } }`. Drop the `FROM_EMAIL` / `FROM_NAME` fields from the payload — SAP no longer sends the mail, our app does.
2. From the parsed response body, walk the nested objects and pull the first values for keys matching (case-insensitive) `ZMAIL`, `ZUSER`, `ZPASSWORD`, `ZSTATUS`. Reuse the existing `collectObjects` helper.
3. Treat the SAP call as successful when HTTP is ok AND (`ZSTATUS` looks successful OR existing `sapSucceeded` says so) AND `sapRejected` is false AND `ZUSER` + `ZPASSWORD` + `ZMAIL` are all present. Otherwise return `{ ok: false, status, error }` with a helpful message (e.g. "SAP did not return credentials for this email").
4. Load No-Reply config + password (already fetched earlier for the payload). Require `enabled`, `host`, `port`, `from_email`, and `app_password`; otherwise return `{ ok: false, error: "No-Reply SMTP is not fully configured..." }` without attempting to send.
5. Build a nodemailer transport from the saved config (same shape as `sendNoReplyTestEmail` in `email-config.functions.ts`: `secure` when encryption=ssl, `requireTLS` for tls/starttls, basic auth when username present).
6. Send an HTML email to `ZMAIL`, cc = saved `cc_recipients`, from = `"<from_name> <from_email>"` (or just `from_email`). Subject: `Your Re Sustainability Approvals credentials`. Include a plain-text fallback.
7. Log the outcome to `sap_api_sync_log` as today, appending whether the mail was sent (e.g. `forgot middleware: 200; mail sent to z***@domain`). Never log the password.
8. Return `{ ok: true, status }` on success. The login page already shows "Password reset request sent" on `ok`.

## HTML template (inline styles, table-based, brand-aligned)

- Header band with app name "Re Sustainability Approvals".
- Greeting using `ZUSER` when it looks like a name, otherwise "Hello,".
- Short intro: "You requested a password reset. Below are your updated credentials."
- Credentials card with three rows: **User ID** = `ZUSER`, **Password** = `ZPASSWORD` (in a monospace box), **Status** = `ZSTATUS`.
- Security note: "For your security, please sign in and change this password immediately. Do not share it with anyone."
- Footer: "This is an automated message from Re Sustainability Approvals. Please do not reply."
- All colors/spacing inline; no external CSS or images required.

Plain-text fallback mirrors the same fields.

## Failure & safety rules
- Never include the SAP password in the sync-log message or in the response.
- If the SMTP send throws, mark the sync-log row `error` with the SMTP error message and return `{ ok: false, error: "Reset succeeded in SAP but the email could not be sent." }` so the user knows to retry / contact admin.
- Middleware / direct HTTP error paths keep the current error messages.

## Verification
- With No-Reply configured and Forgot_API returning `ZMAIL/ZUSER/ZPASSWORD/ZSTATUS`, clicking Send in the Forgot dialog delivers a formatted HTML email to `ZMAIL` and shows the success toast.
- With No-Reply disabled or missing password → toast shows the configuration error, no email sent.
- With SAP returning no credentials → toast shows "SAP did not return credentials..." and no email sent.
