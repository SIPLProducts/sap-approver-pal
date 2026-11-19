# Connect Approve on Transportation (90%) Exception Billing Approvals

## What changes
- Clicking **Approve** (after ticking rows) sends each selected row to SAP API `90%_Approvals_API` (from SAP API Settings), one call per row, with body:
  `{ "approve": { MANDT, WERKS, KUNNR, NAME1, CHK_VALUE, REMARK, APPROV_BY, UPDATE_BY, STATUS } }`
  - All values come from the selected row exactly as SAP returned them (KUNNR leading space kept).
  - APPROV_BY and UPDATE_BY = signed-in user's SAP user ID.
- Button shows "Approving…" and is disabled while running.
- Result popup (existing SweetAlert style) shows only the SAP `MESSAGE` text, e.g. "Approved Sucessfully" — no TYPE, no raw response. Several rows: one message per row.
- On success (TYPE "S"), approved rows are removed from the table; failed rows stay.
- If the API is missing or inactive in settings: popup says "SAP API 90%_Approvals_API is not configured or active."

## Not changed
Reject (still shows the "not connected yet" note), Execute, filters, Reset, table, other screens.

## Technical details
- New server fn `getTransportApprovalsApproveConfig` in `src/lib/sap/customer.functions.ts` (copy of the Get config lookup, case-insensitive name `90%_Approvals_API`).
- In the screen: `approveMutation` using existing `runSapApi`; separate `onApprove` handler; Reject keeps current `onApproveReject`.
- Message shown via existing `swalAlert`/SweetAlert helper used elsewhere, using `extractSapMessage` to pull MESSAGE only.
