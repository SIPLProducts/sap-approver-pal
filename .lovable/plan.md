## Email template: use the real `re` logo + stop Gmail from masking the password

Two changes in `src/lib/auth/sap-forgot.functions.ts` (plus one new asset).

### 1. Replace the top-left logo

Currently the header renders a CSS-drawn red circle with the text "re". Replace it with the uploaded official `re` mark.

- Upload `user-uploads://image-71.png` to Lovable Assets as `src/assets/re-logo.png.asset.json` (CDN URL is required — email clients cannot load `/src/...` paths).
- Import the asset JSON at the top of `sap-forgot.functions.ts`.
- In `buildCredentialsEmail`, swap the `<div>re</div>` block for `<img src="{asset.url}" width="44" height="44" alt="Re Sustainability" style="display:block;border:0;">`.
- Keep the wordmark "Re Sustainability" and the yellow-underlined "RESL Approvals" tagline next to it.

### 2. Show the actual password, no asterisks

The value is already interpolated raw — the masking comes from Gmail/Outlook heuristics that detect a short token next to a "Password" label. Defeat the heuristic without changing the visible password:

- Render the password inside a `<span>` split into per-character `<span>`s (`P` `a` `s` `s` …). Clients that scan for a contiguous secret-looking token no longer see one; the user sees the exact string.
- Wrap that span in a table cell explicitly marked `translate="no"` and `dir="ltr"`, with `user-select:all` and no monospace/box styling.
- Keep the label as "Temporary Password" (already renamed) so it doesn't match `type="password"` heuristics keyed on the exact word "Password:".
- Plain-text variant: unchanged, already shows the raw value.

No other logic changes — extraction, SMTP, subject, CC, logging all untouched.

### Verify

Trigger Forgot Password on `/login` with a real SAP account and confirm the received email shows:
- the red `re` logo image in the header (not a CSS circle),
- "Temporary Password" row rendering the exact API value (e.g. `12345678`) in plain text, no asterisks, in both Gmail web and Outlook.
