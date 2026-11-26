# Add Distance Master Approvals screen

## What will change
- New menu item "Distance Master Approvals" right after Distance Master in IWM Approvals.
- New screen with the same selection card as Transportation (90%) Exception Billing Approvals: same fields, dropdowns, layout and Execute / Reset buttons.
- Not connected to SAP yet: Execute shows "SAP API not configured yet" until you send the API details.
- Own access permission, assignable in Roles like the other IWM screens.
- No existing screen changes.

## Technical details
- New route `src/routes/_authenticated/imw.distance-master-approvals.tsx`, copying the input card of `imw.transportation-exception-billing-approvals.tsx` (no SAP calls, no table).
- Sidebar entry in `src/routes/_authenticated.tsx` after Distance Master, screen key `imw.distance_master_approvals`.
- Register the key/activity in `src/lib/screen-keys.ts` (and IWM screen keys list) and add a line to the existing screen-keys test.
