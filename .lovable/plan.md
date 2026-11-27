# Vehicle Master Approvals: Reject calls VM_APPROVALS-Reject_API

## What you'll see
- Tick Pending rows and click Reject: the usual "Reject selected records?" confirmation appears, then each ticked row is sent to SAP on its own inside "reject".
- Fields sent are the same vehicle fields you chose for Approve: MANDT, WERKS, VEHICLENO, VEHICLECAP, NETWT, VEH_CAP, VEH_TYPE, TRANSPORT_NAME, UPDATED_BY, APPROV_BY, STATUS. Customer (KUNNR) and Distance from the sample aren't sent, because vehicle rows don't have them.
- APPROV_BY is your SAP user ID (row value if your profile has none). The weights go as numbers.
- The popup shows only SAP's MESSAGE, green for "S" and red for "E". After a success the table reloads.

## Technical details
- `getVmApprovalsRejectConfig` in `customer.functions.ts` (name `VM_APPROVALS-Reject_API`), same shape as the Approve one.
- In `imw.vehicle-master-approvals.tsx`: `rejectMutation` mirroring `approveMutation` with key `reject`, plus `confirmReject` using `swalConfirm`; wire to Reject.
- SAP API Settings fields for `VM_APPROVALS-Reject_API`: replace `reject.KUNNR` / `reject.DISTANCE` with the six vehicle fields, reorder, and regenerate both sync scripts.
