## Current finding
The Forgot Password function already builds the SAP request as `{ zmail: enteredEmail }` and currently sends the email with `to: enteredEmail`. However, the previous change removed configured CC recipients, and the mailer does not log SMTP delivery details such as accepted/rejected recipients.

## Plan
1. Keep the entered Forgot Password email as the only primary recipient:
   - SAP request payload remains `{ zmail: data.email }`.
   - SMTP `to` remains the exact same `data.email` value.
   - Do not use any SAP response field to override the recipient.

2. Re-include required configured CC recipients:
   - Read `cc_recipients` from the No-Reply email configuration.
   - Pass those addresses to `sendMail({ cc: ... })`.
   - Keep the entered email in `to`, not only in CC.

3. Add SMTP delivery verification/logging:
   - Capture Nodemailer `sendMail()` result.
   - Log masked `to`, masked CC list, `messageId`, accepted recipients, rejected recipients, and pending recipients in `sap_api_sync_log`.
   - If SMTP rejects the entered `to` address, return a clear error instead of showing success.

4. Validate configuration before sending:
   - Confirm No-Reply sending is enabled.
   - Confirm host, port, from email, and app password are present.
   - Keep using the saved No-Reply SMTP settings from Email Configuration.

## Technical details
- Update `src/lib/auth/sap-forgot.functions.ts` only.
- Use `recipientEmail = data.email` for both SAP payload and SMTP `to`.
- Use `cc: (noReply.cc_recipients ?? []) as string[]` when sending the Forgot Password email.
- Store only masked email addresses in logs; do not log passwords or full addresses.