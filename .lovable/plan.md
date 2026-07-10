# Fix Forgot_API request payload

## Cause
`src/lib/auth/sap-forgot.functions.ts` wraps the email as `{ FORGOT: { EMAIL: data.email } }`. The middleware forwards `inputs` verbatim, so SAP receives the wrapped shape and cannot find the field. Postman shows the working payload is a flat `{ "zmail": "<email>" }`.

## Change (one file)
`src/lib/auth/sap-forgot.functions.ts`:
- Replace `const payload = { FORGOT: { EMAIL: data.email } };` with `const payload = { zmail: data.email };`.
- Both request paths (middleware `POST /login/Forgot_API` with body `{ inputs: payload }`, and direct SAP call with body `payload`) now send the shape SAP expects.
- No middleware, UI, DB, or credential-email-sending changes.

## Verify
- On `/login` → Forgot → Send: SAP receives `{ "zmail": "..." }`, returns `ZMAIL/ZUSER/ZPASSWORD/ZSTATUS`, credentials email is sent via No-Reply SMTP, success toast shown.
