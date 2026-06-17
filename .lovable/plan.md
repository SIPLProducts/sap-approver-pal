## Problem

On the Sales Order Approvals screen, Approve / Reject does not actually call SAP. The server function `submitSalesOrderDecision` looks up an SAP API config named `Sales_Approve_Reject`, but the row configured in Admin → SAP API (with the payload already saved) is named `Sales_Order_Approve_Reject`. The lookup misses, so nothing reaches the middleware and the SweetAlert never shows a real SAP response.

## Fix

**`src/lib/sd/sales-order-approval.functions.ts`**
- Change `DECISION_CONFIG_NAME` from `"Sales_Approve_Reject"` to `"Sales_Order_Approve_Reject"` so the saved Admin → SAP API config (including its payload, endpoint, auth, and request fields) is the one used.
- Update the proxy path from `/sales_order_approval/Sales_Approve_Reject` to `/sales_order_approval/Sales_Order_Approve_Reject` for middlewares that route by name. The existing `/sap/invoke` fallback (by `configId`) is unchanged and continues to work.

**`src/routes/_authenticated/sd.sales-order.tsx`**
- Update the two `console.groupCollapsed` / `console.error` labels from `Sales_Approve_Reject` to `Sales_Order_Approve_Reject` so logs match the API being called.

No UI changes: the same SweetAlert success / failure flow used on Contract, Price, and SC-SO approvals already drives off the server function response and stays as-is — success shows the SAP message, failure shows the upstream status / body in the debug modal.

## Verification

1. Open Sales Order Approvals, select a row, click Approve → confirm middleware log shows a request for `Sales_Order_Approve_Reject` (either `/sales_order_approval/Sales_Order_Approve_Reject` or `/sap/invoke` with the matching `configId`).
2. SweetAlert shows the SAP response message; on error, the debug payload modal shows status + body preview.
3. Repeat for Reject.
