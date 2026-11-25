# Average Selling Rate: New Record checkbox + new Approvals screen

## 1. Average Selling Rate
- Add a **New Record** checkbox right after Plant, styled the same way as on Financial Year Base Rate.
- Reset unticks it. Execute works exactly as today, because this screen has no SAP API yet.

## 2. New screen: Average Selling Rate Approvals
- In the IWM Approvals menu, it sits right after Average Selling Rate and uses the same two-line label style as Financial Year Base Rate Approvals.
- Its selection card matches Financial Year Base Rate Approvals: Plant, Status (Pending / Completed / Rejected), and Execute + Reset on the right.
- No SAP API is connected yet, so Execute shows "SAP API not configured yet". Reset clears the plants and sets Status back to Pending.
- It has its own access permission, which you can assign in Roles like the other IWM screens.

## Technical details
- Edit `imw.average-selling-rate.tsx`: add `newRecord` state, a `Checkbox`, and change the grid to `lg:grid-cols-[220px_auto_1fr]`.
- New route `src/routes/_authenticated/imw.average-selling-rate-approvals.tsx` with the input card copied from `imw.financial-year-base-rate-approvals.tsx` and its own head().
- Screen key `imw.average_selling_rate_approvals` / activity `IMW.AVERAGE_SELLING_RATE_APPROVALS` in screen-keys.ts and IMW_SCREEN_KEYS. Add the sidebar entry in `_authenticated.tsx` and a test line in screen-keys.test.ts.
