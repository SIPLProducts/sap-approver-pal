## Plan

1. **Change the HTML password rendering**
   - Update the account recovery email template in `src/lib/auth/sap-forgot.functions.ts` so the temporary password is rendered as plain visible text from the SAP response.
   - Avoid markup patterns that email clients commonly auto-mask, such as a contiguous value directly inside a field labeled like a password.

2. **Use a safer visible-text layout**
   - Keep the visible label as `Temporary Password`.
   - Render the actual SAP value with harmless HTML separation that preserves the exact visual text for the user, while avoiding automatic masking by Gmail/Outlook-style heuristics.
   - Add email-safe attributes/styles such as `translate="no"`, `dir="ltr"`, and selectable text styling.

3. **Keep non-template logic unchanged**
   - Do not change SAP API calls, response extraction, SMTP sending, CC handling, logging, subject, or the logo.
   - Keep the plain-text email body showing the raw SAP password value exactly.

4. **Verify**
   - Confirm the template source no longer includes any hardcoded asterisks for the temporary password row.
   - Confirm the rendered HTML interpolates the SAP `zpassword` value rather than any masked placeholder.