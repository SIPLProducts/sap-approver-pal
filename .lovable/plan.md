# Average Selling Rate Approvals: connect Approve to SAP

## What changes for you
- Ticking Pending rows and clicking Approve sends each selected row to SAP (AVG_Approvals_Approve_API), with every value taken from the row, including its Average Selling Rate.
- The popup shows only SAP's exact MESSAGE: TYPE "S" = success, "E" = error.
- After a successful approval, the table is reloaded by re-running Execute with the same Plant and Status, so the updated status shows.
- Reject still shows "SAP API not configured yet". Nothing else changes.

## Technical details
- `src/lib/sap/customer.functions.ts`: add `getAvgApprovalsApproveConfig` (looks up `AVG_Approvals_Approve_API`), copied from `getFinanceApproveConfig`.
- `src/routes/_authenticated/imw.average-selling-rate-approvals.tsx`: add an `approveMutation` that mirrors the one on Financial Year Base Rate Approvals. Payload `{ approve: { MANDT, WERKS, KUNNR, MATERIAL, NAME1, AVG_RATE (number), UPDATED_BY, UPDATED_ON, APPROV_BY, STATUS } }`, one call per selected row. Reuse the same `pickSapMessage` and `swalSapResponse` popup. On any success, re-run the existing fetch with the current inputs and clear the selection. Connect the Approve button, which stays disabled while it runs.
