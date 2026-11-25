# Financial Year Base Rate Approvals (new IWM screen)

## What you will see
- New menu item "Financial Year Base Rate Approvals" (two-line label) in IWM Approvals, directly below "Financial Year Base Rate".
- Same input card as Transportation (90%) Exception Billing Approvals: Plant selector, Status choice (Pending / Completed / Rejected), Execute + Reset at the right of the Plant row, same sizes, spacing and styling.
- Reset clears plants, sets Status back to Pending.
- No SAP call yet: Execute only validates Plant until you share the fetch / approve / reject API details. No results table or Approve/Reject buttons until then.
- New permission "Financial Year Base Rate Approvals" in Users & Roles, included with IWM ALL.

## Not changed
All existing screens, APIs, logic and designs.

## Technical details
- New route `src/routes/_authenticated/imw.financial-year-base-rate-approvals.tsx`, copying the input card markup of the transportation approvals screen (PageHeader, PlantMultiSelect, RadioGroup, Button, Card), with its own head().
- Sidebar entry in `src/routes/_authenticated.tsx` after the financial-year-base-rate item; screen key `imw.financial_year_base_rate_approvals` (activity `IMW.FINANCIAL_YEAR_BASE_RATE_APPROVALS`) added in `src/lib/admin/screen-keys.ts` and IMW_SCREEN_KEYS; add a test line in `screen-keys.test.ts`.
