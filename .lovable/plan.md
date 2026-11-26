# Distance Master Approvals — connect Approve to DM_APPROVALS_APPROVE_API

## What changes
- Ticking rows (Pending results) and clicking **Approve** sends one request per selected row to `DM_APPROVALS_APPROVE_API`:
  `{ approve: { MANDT, KUNNR, WERKS, DISTANCE, UPDATED_BY, APPROV_BY, STATUS } }`
  - All values come from the selected row; KUNNR is sent exactly as returned (leading zeros kept); DISTANCE sent as a number (e.g. 22.0).
  - APPROV_BY = the logged-in user's SAP ID (falls back to the row's value if your profile has no SAP ID).
- The existing SAP popup shows only SAP's MESSAGE per row, green for TYPE "S", red for "E".
- After any success the table reloads with the same plants/status.
- Button is disabled while approving. Reject stays as is.

## Technical details
- Add `getDmApprovalsApproveConfig` to `src/lib/sap/customer.functions.ts` (same shape as `getAvgApprovalsApproveConfig`, name `DM_APPROVALS_APPROVE_API`, also returns `userName`).
- In `imw.distance-master-approvals.tsx`, add `pickSapMessage` and `approveMutation` copied from Average Selling Rate Approvals, using `swalSapResponse`; wire the Approve button.
