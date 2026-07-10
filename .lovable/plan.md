## Show real password in the recovery email (no masking)

The code already interpolates the actual password (`${pwd}`) — nothing masks it server-side. The asterisks in the screenshot come from the email client (Gmail/Outlook) auto-obscuring content that *looks like* a password field: a short monospaced value in a gray chip immediately next to the label "Password".

### Change (one file: `src/lib/auth/sap-forgot.functions.ts`)

In `buildCredentialsEmail`, rerender the password value so no email client treats it as a masked secret:
- Drop the monospace chip / gray pill styling around the password value.
- Render it as plain bold text in the same style as the User ID row (dark color, normal weight/size), so the layout stays clean and matches the reference.
- Rename the visible label from "Password" to "Temporary Password" — some clients specifically obfuscate values labeled exactly "Password". Keeps intent clear to the user.
- Plain-text `text` variant already shows the real password; no change there beyond the label rename.

No changes to extraction, transport, subject, or any other logic.

### Verify
Trigger Forgot on `/login` with a real SAP account → email arrives showing the actual password (e.g. `12345678`) as bold text next to "Temporary Password", not asterisks.
