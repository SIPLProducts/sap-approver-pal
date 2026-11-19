# Transportation (90%) Exception Billing Approvals – column names and Approve/Reject buttons

## Changes (this screen only)
1. Table column headers:
   WERKS → Plant, KUNNR → Customer, NAME1 → Customer Name, CHK_VALUE → Check Value,
   REMARK → Remarks, APPROV_BY → Approved By, UPDATE_BY → Update By, STATUS → Status.
2. Approve (green) and Reject (red) buttons at the top-right of the results table, same design and position as Price Master Update Approvals.
   - Shown only when the table was loaded with Pending selected and has records.
   - Disabled until at least one row is ticked; with nothing ticked shows "Select at least one record".
   - For now SAP is not connected: clicking shows a note that Approve/Reject will be connected once the API is set up.

## Not changed
Execute call, payload, filters, row checkboxes, other screens.

## Technical details
- Only `imw.transportation-exception-billing-approvals.tsx`: header label map; remember the status used at the last Execute so changing the radio without executing doesn't toggle the buttons; pass buttons via `headerExtras` like Price Master Approvals.
