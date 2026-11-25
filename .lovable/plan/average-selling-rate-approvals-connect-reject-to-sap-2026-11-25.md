# Average Selling Rate Approvals: connect Reject to SAP

## What changes for you
- Select Pending rows and click Reject. After the existing confirmation, the app sends each row to SAP (AVG_Approvals_Reject_API). Every value comes from the row, including its Average Selling Rate.
- Approver (APPROV_BY) is filled with your own SAP user ID.
- The popup shows only SAP's exact MESSAGE: TYPE "S" means success, "E" means error.
- After a successful rejection, the table reloads with the same Plant and Status, so you see the new status.
- Approve and the rest of the screen stay the same.

## Technical details
- `src/lib/sap/customer.functions.ts`: add `getAvgApprovalsRejectConfig`. It looks up `AVG_Approvals_Reject_API`, which is saved as PUT and active, and returns the logged-in user's `sap_user_id` as `userName`, the same way `getAvgApprovalsGetConfig` does.
- `src/routes/_authenticated/imw.average-selling-rate-approvals.tsx`: add a `rejectMutation` that mirrors `approveMutation`. It sends `{ reject: { MANDT, WERKS, KUNNR, MATERIAL, NAME1, AVG_RATE (number), UPDATED_BY, UPDATED_ON, APPROV_BY: userName, STATUS } }` once per selected row, and reuses `pickSapMessage` and `swalSapResponse`. When at least one row succeeds, it re-runs the fetch. `confirmReject` calls this mutation instead of the "not configured" toast. The Reject button stays disabled while the request runs.
