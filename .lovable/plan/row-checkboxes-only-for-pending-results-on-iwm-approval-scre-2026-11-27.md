# Row checkboxes only for Pending results on IWM Approval screens

## What changes
On every IWM Approval screen, the results table shows row checkboxes only when Execute ran with **Pending**. With **Completed** or **Rejected**, the table shows the same columns without checkboxes. Approve/Reject for Pending stays as it is.

## Screens
- Distance Master Approvals: already behaves this way. No change.
- Financial Year Base Rate Approvals: `showSelect` becomes `showSelect={executedStatus === "pending"}`.
- Average Selling Rate Approvals: same one-line change.
- Transportation (90%) Exception Billing Approvals: same one-line change.
- Price Master Approvals: `showSelect={status === "pending"}`. Changing the radio already clears the results, so the table always matches the selected status.

## Technical details
- Only the `showSelect` prop on `CloudscapeApprovalTable` changes in four files.
- APIs, payloads, mutations, buttons, columns and styling stay the same.
- Check: typecheck, then open one screen with Completed and confirm the checkboxes are gone.
