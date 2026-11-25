# Average Selling Rate Approvals: Execute fetch via AVG_Approvals_GET_API

## What changes
- **Execute** calls `AVG_Approvals_GET_API` (from SAP API Settings) with your SAP user name, the selected plants, and the status flags:
  - Pending → `R_pen: "X"`, Completed → `R_APPR: "X"`, Rejected → `R_REJ: "X"`; unselected ones sent as `" "` (same as Financial Year Base Rate Approvals).
- Results table below the selection area with columns: Plant, Customer, Customer Name, Material, Average Selling Rate, Updated Person, Updated Date, Approver, Status. Empty values show "—", 0 shows "0". MANDT kept in row data, not shown.
- **Pending + Execute:** row checkboxes and Approve / Reject buttons at the table's top right, disabled until a row is selected — same look and behavior as Financial Year Base Rate Approvals. They show "SAP API not configured yet" until you send the Approve/Reject API details.
- Completed / Rejected: table only, no checkboxes or buttons.
- Reset also clears the table and selection.

## Technical details
- Add `getAvgApprovalsGetConfig` server function in `src/lib/sap/customer.functions.ts`, mirroring `getFinanceApprovalsGetConfig` but looking up `AVG_Approvals_GET_API`.
- Rewrite only the body of `src/routes/_authenticated/imw.average-selling-rate-approvals.tsx`, copying the fetch, table, selection and pagination pattern from the Financial Year Base Rate Approvals screen (AVG_RATE instead of FIN_RATE). No other screens touched.
