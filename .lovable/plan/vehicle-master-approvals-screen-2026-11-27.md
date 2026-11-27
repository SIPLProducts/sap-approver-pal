# Vehicle Master Approvals screen

## What you'll see
- A new menu item "Vehicle Master Approvals" in IWM Approvals, right after Vehicle Master.
- Its selection card matches Distance Master Approvals exactly: Plant picker, Execute and Reset buttons, and a Status choice (Pending / Completed / Rejected) below a divider.
- Not connected to SAP yet: Execute shows "SAP API not configured yet" until you send the API details. Reset clears Plant and sets Status back to Pending.
- The screen gets its own access permission, so it can be given to roles like the other IWM screens.

## Technical details
- New route `src/routes/_authenticated/imw.vehicle-master-approvals.tsx`, selection card copied from `imw.distance-master-approvals.tsx` (no table/SAP calls yet).
- Sidebar entry in `_authenticated.tsx` after Vehicle Master (two-line label, same icon), screen `imw.vehicle_master_approvals`.
- `screen-keys.ts`: add `{ key: "imw.vehicle_master_approvals", label: "Vehicle Master Approvals", activity: "IMW.VEHICLE_MASTER_APPROVALS" }` and append to `IMW_SCREEN_KEYS`; add matching lines to `screen-keys.test.ts` and run the tests.
- No existing screen, API or logic changes.
