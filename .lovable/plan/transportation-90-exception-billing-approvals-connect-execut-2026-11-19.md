# Transportation (90%) Exception Billing Approvals – connect Execute and show results

## What changes
- Execute calls the SAP API `90%_Approvals_Get_Data` (from SAP API Settings) instead of the "UI-only" message.
- Request payload:
  - `get_data.user_name` = signed-in user ID
  - `get_data.plant` = `[{ "plant": "<code>" }]` for each selected plant
  - Status flags from the radio buttons: Pending → `R_pen:"X"`, Completed → `R_APPR:"X"`, Rejected → `R_REJ:"X"`; unselected flags sent as `" "`.
- Results table below the filters with column headers showing the exact response field names:
  `WERKS | KUNNR | NAME1 | CHK_VALUE | REMARK | APPROV_BY | UPDATE_BY | STATUS` (MANDT hidden, same as the Exception Billing screen).
- Each row gets a selection checkbox (same design as other IWM approval screens); `CHK_VALUE` shown as a read-only checked/unchecked box (`"X"` = checked).
- All returned records shown dynamically; SAP errors shown with the exact SAP message; empty result shows "No records".

## Not changed
- Plant F4, status radios, layout, other screens, permissions, Approve/Reject (not part of this request).

## Technical details
- Add `getTransportApprovalsGetConfig` server function in `src/lib/sap/customer.functions.ts` (case-insensitive lookup of `90%_Approvals_Get_Data`), mirroring `getTransportBillingConfig`.
- Edit only `imw.transportation-exception-billing-approvals.tsx`: reuse `runSapApi`, the same table component and row-checkbox pattern from `imw.transportation-exception-billing.tsx`.
