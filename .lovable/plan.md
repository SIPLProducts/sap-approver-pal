## Root cause

The Sales Order approve/reject payload built by the app is correct (DATA contains the row). The problem is in the middleware route mapping — SAP receives an empty / collapsed body because the request takes the wrong code path.

### What happens today

App posts to:
```
POST {middleware}/sales_order_approval/Sales_Order_Approve_Reject
body: { "inputs": { USER_ID, APPROV, REJ, DATA: [...] } }
```

Middleware (`middleware/server.js` line 646) only registers:
```
/sales_order_approval/Sales_Approve_Reject   →   config "Sales_Approve_Reject"
```

So `/Sales_Order_Approve_Reject` (with `Order_`) returns **404 "Cannot POST …"**. The app's fallback in `submitSalesOrderDecision` then re-posts to `/sap/invoke`, which runs `invokeSap` → `buildRequestPayload(cfg.requestFields, inputs)`. That builder maps **only** the scalar request fields configured for the API (USER_ID / APPROV / REJ) and silently drops `DATA` (because `DATA` is an array, not a configured scalar `request_field`). SAP therefore receives an empty `DATA` ⇒ "0 rows".

Contract approve/reject works because its app path and middleware path match exactly (`/contract_approval/Contract_Approve_Reject` ↔ config `Contract_Approve_Reject`, raw passthrough preserves `DATA`).

## Fix

Single-line middleware change so the SO write endpoint is also a raw passthrough and the route + config name match what the app already sends.

### `middleware/server.js` (line 646)

Change:
```js
namedRawInvokeRoute("/sales_order_approval/Sales_Approve_Reject", "Sales_Approve_Reject");
```
to:
```js
namedRawInvokeRoute("/sales_order_approval/Sales_Order_Approve_Reject", "Sales_Order_Approve_Reject");
```

This makes the middleware:
- expose the path the app calls (`…/Sales_Order_Approve_Reject`)
- load the SAP API config the user already has (`Sales_Order_Approve_Reject`)
- use **raw passthrough** (`invokeSapRaw`), which forwards `inputs` verbatim to SAP — preserving the full `DATA` array

### Required user action

Restart the local middleware (`node server.js` / Windows service) after the change so the new route is registered. No DB / SAP config change is needed.

### How to verify

1. Restart middleware; in its console, on approval click you should see:
   ```
   [raw-invoke] PUT <sap-url> payload= {"USER_ID":"…","APPROV":"X","REJ":"","DATA":[{…}]}
   ```
   instead of a 404 + `/sap/invoke` log.
2. SAP response should report 1 row processed (not 0).
3. Re-run with reject to confirm both branches.

### Out of scope

- No changes to `src/lib/sd/sales-order-approval.functions.ts` — the payload it builds is already correct.
- No DB migration.
- Other approval flows (Price, Contract, SC/SO, Service Certificate) are unaffected.
