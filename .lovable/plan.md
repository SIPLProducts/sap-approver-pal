# Financial Year Base Rate Approvals: Reject via Finace_Reject_API

## What changes
- Clicking Reject asks for confirmation (same as other Reject buttons in the app), then sends each selected row to SAP `Finace_Reject_API`.
- Payload per row: `{ "reject": { MANDT, WERKS, KUNNR, MATERIAL, NAME1, FIN_RATE (number), UPDATED_BY, UPDATED_ON, APPROV_BY, STATUS } }`, all taken from the selected row.
- TYPE "S" = success (row removed from table), "E" = error. Popup shows only the MESSAGE text.
- Approve, fetch, UI and other screens untouched.

## Technical details
- `src/lib/sap/customer.functions.ts`: add `getFinanceRejectConfig` (same pattern as `getFinanceApproveConfig`, name `Finace_Reject_API`).
- `src/routes/_authenticated/imw.financial-year-base-rate-approvals.tsx`: add `rejectMutation` mirroring `approveMutation` (reuse `pickSapMessage`, `swalSapResponse`), wrap in `swalConfirm`, wire Reject button and disable while pending.
