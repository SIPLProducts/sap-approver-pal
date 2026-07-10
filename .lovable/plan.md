## Goal
Ensure the Forgot Password email is delivered to the exact email address entered in the login form, not to any email returned by SAP or configured as CC.

## Plan
1. Update the Forgot Password server function so the recipient is always the user-entered email from the request payload.
2. Stop using SAP response fields to determine the email recipient. SAP response values like `ZUSER`, `ZPASSWORD`, and `ZSTATUS` will still be rendered in the email body dynamically.
3. Prevent No-Reply CC recipients from receiving Forgot Password credential emails, unless you explicitly want CC for this sensitive flow.
4. Update logging so it records the masked user-entered recipient, making delivery debugging clear without exposing the full address.
5. Verify the flow by checking that the SMTP `to` value is the entered email and no alternate response/configured address is used.

## Technical details
- Change `src/lib/auth/sap-forgot.functions.ts`.
- Replace recipient resolution with `const zmail = data.email` or equivalent.
- Remove/ignore `findRecipient(fields, data.email)` for this flow.
- Send mail with `to: data.email`.
- For credential recovery, omit `cc: noReply.cc_recipients` to avoid sending passwords to configured CC recipients.