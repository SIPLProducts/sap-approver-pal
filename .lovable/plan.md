## Redesign credentials email to match the Visitor Safety Permit card style

Update `src/lib/auth/sap-forgot.functions.ts` only. No logic changes — just the email template and subject.

### Changes

1. **Subject line** — change from `"Your Re Sustainability Approvals credentials"` to `"Account Recovery Successful: RESL APPROVALS Login Information"`.

2. **`buildCredentialsEmail` HTML redesign** — mirror the uploaded badge card:
   - Soft gray page background (`#f3f4f6`), centered white card with rounded corners (~16px) and subtle shadow.
   - Header row: red "re" logo mark on the left + "Re Sustainability" wordmark in bold red (`#d4202a`), with a small yellow-underlined tagline "RESL Approvals" beneath.
   - Divider, then a light-gray highlighted name block showing the user (e.g. "SARVI_INFO1") with a small ID-style caption below (using the ZUSER as the account ID).
   - Two-column label/value rows (label in muted gray uppercase-ish small text, value in dark bold) for:
     - **User ID** → `ZUSER`
     - **Password** → `ZPASSWORD` (monospaced, slight background chip)
   - **Remove the Status field entirely.**
   - Footer line inside the card in muted gray: "Please sign in and change your password immediately after login."
   - Outside the card, tiny centered copyright line.
   - Keep inline styles table-based for email-client compatibility. No external images/fonts (use system font stack). Keep the escaping helpers.

3. **Plain-text `text` variant** — mirror the new content, drop the Status line.

4. **`zstatus` parameter** — keep extraction upstream (still logged), but remove it from the `buildCredentialsEmail` signature/usage since it's no longer rendered.

### Out of scope
No changes to SAP call, SMTP transport, field extraction, DB, or UI outside this file.

### Verify
Trigger Forgot on `/login` → receive an email whose layout matches the uploaded badge card (red header, name block, two info rows, no Status), with the new subject line.
