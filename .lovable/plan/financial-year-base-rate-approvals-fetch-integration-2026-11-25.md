# Financial Year Base Rate Approvals – fetch integration

## What changes
On the Financial Year Base Rate Approvals screen, Execute calls `Finance_Approvals_Get_API` (already in SAP API Settings) and fills the results table. Reset keeps clearing everything as today.

## Payload (built dynamically)
```json
{ "get_data": { "user_name": "<logged-in SAP ID>",
  "plant": [{ "plant": "<each selected plant>" }],
  "R_pen": "X|' '", "R_APPR": "X|' '", "R_REJ": "X|' '" } }
```
Exactly one of R_pen / R_APPR / R_REJ is "X", matching the Pending / Completed / Rejected choice.

## Table
Columns in order: Plant (WERKS), Customer (KUNNR), Customer Name (NAME1), Material (MATERIAL), Financial Base Rate (FIN_RATE), Updated person (UPDATED_BY), Updated Date (UPDATED_ON), Approver (APPROV_BY), Status (STATUS). MANDT kept in row data, not shown. Same table look, selection checkboxes and pagination as Transportation (90%) Exception Billing Approvals. SAP messages (e.g. no data) shown in the standard SAP response dialog.

## Approve / Reject
Shown top-right of the table only after Execute in Pending mode, same design and placement as Transportation (90%) Approvals, disabled until rows are selected. No approve/reject API was provided, so clicking them shows "SAP API not configured yet" until you send those API names and payloads.

## Technical
- Only edit `src/routes/_authenticated/imw.financial-year-base-rate-approvals.tsx` (existing route), reusing the fetch/table pattern from the transportation approvals route and `runSapApi` by config name.
- No changes to other screens, API configs or settings scripts.
