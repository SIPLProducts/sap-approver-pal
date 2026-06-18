# Fix: DATA array dropped on Service Certificate Approve/Reject

## Root cause

The app POSTs the approve/reject payload (with nested `DATA[]` containing `ADV_DOC_NUM`) to the middleware path:

```
/service_certificate/Service_Certificate_Approve_Reject
```

But `middleware/server.js` only registers a **fetch** route for service certificate:

```js
namedRawInvokeRoute("/service_certificate/Fetch", "Sevice_Certificate_Fetch");
```

There is **no** route for `/service_certificate/Service_Certificate_Approve_Reject`. So the request 404s, and the app's fallback in `submitScSoDecision` retries against `/sap/invoke`.

`/sap/invoke` runs `invokeSap()` → `buildRequestPayload(cfg.requestFields, inputs)`, which only emits the fields explicitly configured in `sap_api_request_fields` for that config (APPROV, REJ, USER_ID). The nested `DATA` array is **not** a configured request field, so it is stripped before being sent to SAP. That's exactly what SAP is reporting: APPROV/REJ/USER_ID arrive, DATA does not.

It is **not** an issue with the nested `ADV_DOC_NUM` object — the JSON itself is valid; the field mapper is the one dropping it.

The other approve/reject endpoints (Price, Contract, Sales Order) work because each has its own `namedRawInvokeRoute(...)` that bypasses field mapping and forwards the body verbatim.

## Change

`middleware/server.js` — add one line next to the existing service certificate fetch route:

```js
namedRawInvokeRoute(
  "/service_certificate/Service_Certificate_Approve_Reject",
  "Service_Certificate_Approve_Reject",
);
```

This routes through `invokeSapRaw()`, which sends `inputs` (the full `{ APPROV, REJ, USER_ID, DATA: [...] }` object including the nested `ADV_DOC_NUM`) to SAP verbatim using the config's HTTP method (PUT) and endpoint URL.

## Deploy / restart

Middleware runs as a separate Node service (Windows service or container). After this code change the operator must restart the middleware process so the new route is registered. No app-side, DB, or SAP config change is required.

## Verification

1. From the SC & SO Approvals screen, select a row, enter a reason, click Accept.
2. Middleware log should now show:
   ```
   [request] POST /service_certificate/Service_Certificate_Approve_Reject
   [raw-invoke] PUT http://10.150.150.154:8103/.../service?sap-client=300 payload= {"APPROV":"X",..."DATA":[{...}]}
   ```
3. SAP should respond with `{ "MESSAGE": [{ "TYPE": "S", "MSG": "Mail Sent Successfully" }] }` and the result dialog renders the success banner.

## Out of scope

- No changes to `submitScSoDecision`, the UI, or the SAP API config rows.
- The existing `/sap/invoke` fallback in the app stays as-is (harmless once the named route exists).
