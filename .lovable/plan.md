1. Redesign `src/routes/login.tsx` while keeping the existing two-column layout and the current color palette (RESL red, ivory, gold, white).
   - Remove the “Continue with Google” button and the `google` sign-in handler.
   - Remove the unused `lovable` import and any other imports that become unused.
   - Remove the KPI/statistic cards (the `dl` grid showing “Pending today”, “Median decision”, “Approved · 7d”).
   - Replace the hero marketing headline/subtitle with concise, secure SAP-approvals focused copy (e.g., emphasizing secure SAP workflow approvals, auditability, and single console).
   - Simplify the right-hand form to only essential sign-in fields: User ID, Password, and the Sign in button.
   - Remove the sign-up toggle and the full-name field so the page is login-only.
   - Remove the demo-accounts panel to keep the page professional and minimal.
   - Keep the brand logo, gradient/blur hero styling, and the trust badges at the bottom (SSO · MFA, uptime, SAP-certified) because they reinforce the secure-approvals message.

2. Verify with `tsgo` typecheck and a quick visual check in the preview to ensure the page is clean and the two-column layout remains intact.