# Vehicle Master Approvals: Approve calls VM_APPROVALS-Approve_API

## What you'll see
- Tick Pending rows and click Approve: each ticked row is sent to SAP on its own, inside "approve", with MANDT, WERKS, VEHICLENO, VEHICLECAP, NETWT, VEH_CAP, VEH_TYPE, TRANSPORT_NAME, UPDATED_BY, APPROV_BY and STATUS from that row (no Customer or Distance).
- APPROV_BY is your SAP user ID (row value if your profile has none), same as Distance Master Approvals. VEHICLECAP and NETWT go as numbers.
- The popup shows only SAP's MESSAGE, green for TYPE "S", red for "E". After a success the table reloads. Approve is disabled while it runs.
- Reject stays "SAP API not configured yet".

## Technical details
- `getVmApprovalsApproveConfig` in `src/lib/sap/customer.functions.ts` (name `VM_APPROVALS-Approve_API`, returns `userName`), same shape as `getDmApprovalsApproveConfig`.
- In `imw.vehicle-master-approvals.tsx`: copy `pickSapMessage`, `swalSapResponse` usage and `approveMutation` from Distance Master Approvals with the vehicle field mapping; wire to Approve.
- SAP API Settings request fields for `VM_APPROVALS-Approve_API`: remove `approve.KUNNR` and `approve.DISTANCE`, add `approve.VEHICLENO`, `approve.VEHICLECAP`, `approve.NETWT`, `approve.VEH_CAP`, `approve.VEH_TYPE`, `approve.TRANSPORT_NAME` (source column), reorder; then regenerate both sync scripts with `scripts/generate-sap-sync.py`.
