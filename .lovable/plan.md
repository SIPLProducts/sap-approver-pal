Plan: Fix Forgot Password email logo visibility

1. Diagnosis
   - The Forgot Password email in `src/lib/auth/sap-forgot.functions.ts` references the logo with a hardcoded absolute URL: `https://sap-approver-pal.lovable.app/__l5e/assets-v1/...`.
   - This URL currently returns an HTTP 302 redirect to the custom domain (`smartapps.siplproducts.com`). Many email clients block or do not follow cross-domain redirects for images, causing the top-left logo to appear broken on desktop/laptop clients.

2. Fix approach
   - At email send time, fetch the logo image bytes from the asset URL.
   - Attach the image inline to the nodemailer message using `attachments: [{ cid: 're-logo', ... }]`.
   - Change the HTML `<img src="...">` to use `src="cid:re-logo"` so the image is embedded and does not rely on external URLs or redirects.
   - Make the logo image responsive: add `max-width:100%; height:auto;` CSS and keep the explicit `width`/`height` attributes for email-client fallback.

3. Files to change
   - `src/lib/auth/sap-forgot.functions.ts`
     - Add a helper to fetch the logo asset and return it as a Buffer with the correct MIME type.
     - Update `buildCredentialsEmail` to use `cid:re-logo` instead of the external `LOGO_URL`.
     - Update `transport.sendMail` to include the inline attachment.
     - Add responsive image styles (e.g., `style="width:100%;max-width:52px;height:auto;"`).

4. No other changes
   - This fix only touches the Forgot Password email template and logo embedding logic.
   - No SAP API, middleware, UI, business logic, or other email templates will be modified.

5. Verification
   - After the change, trigger a Forgot Password flow and inspect the sent email source to confirm:
     - The `<img>` uses `src="cid:re-logo"`.
     - The MIME message contains an inline attachment with `Content-ID: <re-logo>`.
   - Visually confirm the logo renders in the email preview on both desktop and mobile layouts.