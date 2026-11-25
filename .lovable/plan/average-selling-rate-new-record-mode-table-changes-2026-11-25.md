# Average Selling Rate: New Record mode table changes

When Execute is run with New Record ticked:
- Hide the Updated Person, Updated Date, Approver and Status columns.
- Show a checkbox at the start of each row so rows can be selected, the same as on Financial Year Base Rate.
- Show a Save button at the top right of the table, the same as on Financial Year Base Rate. It stays disabled until at least one row is selected.

When New Record is not ticked, the table stays as it is now: all columns, no checkboxes, no Save button.

No Save API has been provided yet, so for now clicking Save shows "SAP API not configured yet". I'll connect it once you send the API details.

## Technical details
- `src/routes/_authenticated/imw.average-selling-rate.tsx` only: add `executedCheck` and `selectedRowKeys` state, filter the columns when the check is "X", and pass `showSelect`, `selectedKeys`, `onSelectionChange` and a `headerExtras` Save button to `CloudscapeApprovalTable` only in that mode. Execute and Reset clear the selection.
