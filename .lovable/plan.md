# Send credentials email to the requested address when SAP omits ZMAIL

## Cause
SAP's `Forgot_API` returns `[{ "ZUSER", "ZPASSWORD", "ZSTATUS" }]` — no `ZMAIL` field. `src/lib/auth/sap-forgot.functions.ts` currently requires `zmail` from the response and aborts with "SAP did not return credentials for this email" when it's missing, so no email is sent.

## Change (one file)
`src/lib/auth/sap-forgot.functions.ts`:
- After the field extraction, if `zmail` is empty, fall back to the input `data.email` (the address the user typed in the Forgot dialog) as the recipient.
- Keep the "missing credentials" error only when `zuser` or `zpassword` is missing.
- No other logic, UI, DB, or middleware changes.

## Verify
- Trigger Forgot on `/login` with `pradeep.p@sharviinfotech.com`.
- SAP responds with `[{ ZUSER: "SARVI_INFO1", ZPASSWORD: "12345678", ZSTATUS: "ACTIVE" }]`.
- App sends the credentials HTML email to `pradeep.p@sharviinfotech.com` via the saved No-Reply SMTP; success toast shows.
