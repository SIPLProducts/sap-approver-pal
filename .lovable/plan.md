## Add Sales Order routes to the Node middleware

**Root cause:** `middleware/server.js` only registers named routes for Price and Contract approvals. The Sales Order screen posts to `/sales_order_approval/Fetch` and `/sales_order_approval/Sales_Approve_Reject`, which return 404. The app's server function then silently falls back to the generic `/sap/invoke` route — that's why your Node backend shows no per-request log for the SO calls, and why the error surfaces as a bland `502 / status:401 / data:{}` instead of a real SAP response. (The inner `401` is SAP itself rejecting auth on that fallback path.)

**Fix — edit `middleware/server.js`** (single block, next to the existing contract routes around line 563):

```js
// SD — Sales Order Approvals
namedInvokeRoute("/sales_order_approval/Fetch",                      "Sales_Approval_Fetch");
namedRawInvokeRoute("/sales_order_approval/Sales_Approve_Reject",    "Sales_Approve_Reject");
```

No other middleware changes. No app/route/server-function changes.

### After the change

1. Restart `node server.js`.
2. Click Execute on Sales Order Approvals.
3. The Node console will now log `[sap-middleware] POST /sales_order_approval/Fetch …` plus the upstream URL, status, and body preview — same format as the contract logs you already see.
4. If SAP still answers 401, that's a SAP-side auth issue on the `Sales_Approval_Fetch` config (credentials / endpoint URL in Admin → SAP API), not a middleware routing issue — the logs will now tell you exactly which upstream URL is being called so you can confirm.

### Preconditions in the app (no change, just verify)

- Admin → SAP API has rows named exactly `Sales_Approval_Fetch` and `Sales_Approve_Reject`, both Active.
- Their `endpoint_url`, credentials, and (for fetch) HTTP method match what SAP expects — same as the contract configs.
