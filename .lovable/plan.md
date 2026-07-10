## Likely issue

The SAP/API response only proves the reset request succeeded. It does not prove SMTP delivered the email to the entered address.

Based on the current flow, the likely causes are:

1. **SMTP accepted the message but did not accept the typed recipient**
   - Some mail servers return success for the overall send while listing recipients as rejected or pending.
   - The app must inspect Nodemailer's `accepted`, `rejected`, and `pending` arrays, not just assume `sendMail()` success means delivery.

2. **Email is going only to configured CC recipients**
   - If the `to` recipient is rejected, but CC recipients are accepted, people in CC can receive the email while the user-entered address does not.
   - This matches the symptom: “others got the mail, but the entered email did not.”

3. **The typed recipient is being blocked downstream**
   - The app can send to `harshinil@sharviinfotech.com`, but the recipient domain may reject, quarantine, spam-filter, or silently drop the message.
   - The backend can only verify SMTP handoff; final inbox delivery depends on the recipient mail server.

4. **No-Reply SMTP configuration may be incomplete or misaligned**
   - The configured SMTP account, `from_email`, `username`, encryption mode, or sender domain authentication could cause recipient-specific delivery failure.

## Verification plan

1. **Confirm recipient routing in code**
   - Ensure SAP payload remains `{ zmail: enteredEmail }`.
   - Ensure SMTP `to` is exactly the email typed in the Forgot Password input.
   - Ensure configured CC recipients are passed as `cc`, not replacing `to`.

2. **Verify No-Reply email configuration**
   - Check whether No-Reply sending is enabled.
   - Confirm SMTP host, port, encryption, sender email, username, and app password are configured.
   - Confirm CC recipients are loaded from the email configuration.

3. **Add/inspect SMTP delivery evidence**
   - Capture the SMTP send result.
   - Log masked versions of:
     - primary `to` recipient
     - CC recipients
     - SMTP `messageId`
     - accepted recipients
     - rejected recipients
     - pending recipients
   - If the entered `to` address appears in `rejected`, return a visible error instead of showing success.

4. **Check backend send logs for the affected email**
   - Look for the latest Forgot Password log entry.
   - Confirm whether `harshinil@sharviinfotech.com` was accepted, rejected, or pending by SMTP.

## Expected result

After verification, we should be able to tell whether the issue is:

- the app not sending to the typed address,
- SMTP rejecting only the typed address,
- SMTP accepting the address but the recipient mail system filtering/dropping it,
- or a No-Reply configuration issue.

## Implementation scope if approved

Update only the Forgot Password server function if needed, keeping the entered email as `to` and preserving required CC recipients, with delivery logging and rejection handling.