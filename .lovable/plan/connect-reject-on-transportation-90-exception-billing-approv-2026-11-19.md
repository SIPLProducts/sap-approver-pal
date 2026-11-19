# Connect Reject on Transportation (90%) Exception Billing Approvals

## What changes
- Clicking **Reject** (after ticking rows) first asks for confirmation (existing red confirm popup, like other Reject actions), then sends each selected row to SAP API `90%_Reject_API`, one call per row:
  `{ "reject": { MANDT, WERKS, KUNNR, NAME1, CHK_VALUE, REMARK, APPROV_BY, UPDATE_BY, STATUS } }`
  - Values come from the selected row exactly as SAP returned them (KUNNR leading space kept).
  - APPROV_BY and UPDATE_BY = signed-in user's SAP user ID.
- Button shows "Rejecting…" and is disabled while running.
- Result popup (same SweetAlert as Approve) shows only the SAP `MESSAGE`, e.g. "Rejected Sucessfully".
- Rejected rows (TYPE "S") are removed from the table; failed rows stay.
- If the API is missing/inactive: popup says "SAP API 90%_Reject_API is not configured or active."

## Not changed
Approve, Execute, Reset, filters, table, other screens.

## Technical details
- New server fn `getTransportApprovalsRejectConfig` in `src/lib/sap/customer.functions.ts` (case-insensitive lookup of `90%_Reject_API`, mirrors the Approve one).
- In the screen: `rejectMutation` reusing `pickSapMessage` and `runSapApi`; `onReject` handler with `swalConfirm`; Reject button wired to it. The old placeholder `onApproveReject` is removed once unused.
