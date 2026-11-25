# Connect Approve to Finace_Approve_API (Financial Year Base Rate Approvals)

## What changes
- Clicking **Approve** (shown only after Execute with Pending) calls `Finace_Approve_API` once per selected row.
- Payload per row: `{ "approve": { MANDT, WERKS, KUNNR, MATERIAL, NAME1, FIN_RATE, UPDATED_BY, UPDATED_ON, APPROV_BY, STATUS } }`, every value taken from that row as returned by SAP (FIN_RATE sent as a number).
- Response: `TYPE "S"` = success, `TYPE "E"` = error. The existing SweetAlert shows only the `MESSAGE` text (one line per row when several are approved).
- Successfully approved rows are removed from the table and selection cleared, same as Transportation (90%) Approvals.
- Reject stays as it is today (not configured message).

## Technical details
- `src/lib/sap/customer.functions.ts`: add `getFinanceApproveConfig` server function (same pattern as `getFinanceApprovalsGetConfig`) looking up `Finace_Approve_API`.
- `src/routes/_authenticated/imw.financial-year-base-rate-approvals.tsx`: replace the Approve placeholder handler with the API call via existing `runSapApi`, reuse existing SAP message extraction and Swal helpers used by the Transportation approvals screen. No API Settings or other screens touched.
