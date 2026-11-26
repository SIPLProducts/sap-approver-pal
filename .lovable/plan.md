# Distance Master Approvals — connect Reject to DM_APPROVALS_REJECT_API

## What changes
- Ticking Pending rows and clicking **Reject** first shows the usual "Reject selected records?" confirmation (same as Financial Year Base Rate Approvals), then sends one request per row to `DM_APPROVALS_REJECT_API`:
  `{ Reject: { MANDT, KUNNR, WERKS, DISTANCE, UPDATED_BY, APPROV_BY, STATUS } }` (capital R key).
  - Values come from the selected row; KUNNR keeps leading zeros; DISTANCE sent as a number.
  - APPROV_BY = logged-in user's SAP ID (falls back to the row's value), same as Approve.
- The SAP popup shows only SAP's MESSAGE per row (green for TYPE "S", red for "E"); after any success the table reloads.
- Reject is disabled while it runs. Approve is unchanged.

## Technical details
- Add `getDmApprovalsRejectConfig` to `src/lib/sap/customer.functions.ts` (same shape as `getDmApprovalsApproveConfig`, name `DM_APPROVALS_REJECT_API`).
- In `imw.distance-master-approvals.tsx`, add `rejectMutation` mirroring `approveMutation` and a `confirmReject` using the existing `swalConfirm`; wire the Reject button.
