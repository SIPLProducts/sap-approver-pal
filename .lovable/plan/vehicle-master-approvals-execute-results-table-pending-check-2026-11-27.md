# Vehicle Master Approvals: Execute, results table, Pending checkboxes and buttons

## What you'll see
- Execute calls `VM_APPROVALS-GET_API` (from SAP API Settings) with your SAP user ID, the chosen plants, and the Status as R_pen / R_APPR / R_REJ ("X" for the chosen one, " " for the others).
- Results table columns: Plant, Vehicle Number, Material Qty - RTO-CAPACITY (in Tons), Material Net Weight * 90%, Vehicle Tonnage, Vehicle Type, Transport Name, Updated Person, Approver, Status. MANDT kept in each row but not shown; numbers like 22.0 shown as 22.
- Pending: a checkbox on every row, and Approve (green) and Reject buttons at the top right of the table. These two buttons show "SAP API not configured yet" until you send their API details.
- Completed / Rejected: table only, no checkboxes or buttons. Reset clears the table.

## Technical details
- Add `getVmApprovalsGetConfig` (name `VM_APPROVALS-GET_API`) to `src/lib/sap/customer.functions.ts`, same shape as `getDmApprovalsGetConfig`.
- Rewrite `imw.vehicle-master-approvals.tsx` from the current Distance Master Approvals pattern: `fetchMutation` via `runSapApi`, `extractRows`, `rows`/`executedStatus`/`selectedKeys`, `CloudscapeApprovalTable` with `showSelect={executedStatus === "pending"}` and Pending-only `headerExtras`.
- No other screens change.
