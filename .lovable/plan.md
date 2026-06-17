## Root cause

The app's call **does** reach the middleware. Console shows it falls back to `POST /sap/invoke` and the middleware returns `200 {"ok":true,"data":null}` — i.e. the call succeeded but SAP returned no rows.

Reason: `/sap/invoke` runs `invokeSap → buildRequestPayload(cfg.requestFields, inputs)`. Only fields registered in **Admin → SAP API → Request Fields** for `Sevice_Certificate_Fetch` are forwarded to SAP. If that mapping is empty/partial, fields like `PLANT`, `USER_ID`, `service`, `Sales` are dropped and SAP responds with empty data — exactly what we see.

In Postman the user posts the JSON body **verbatim** to SAP (or to a passthrough), so SAP receives all 9 fields and returns rows.

There is also no `/service_certificate/Fetch` route registered in `middleware/server.js`, which is why the first attempt returns 404 before the fallback hits `/sap/invoke`.

## Fix

Add a **raw passthrough** named route in the middleware for Service Certificate (same pattern as `Price_Approve_Reject` / `Sales_Approve_Reject` — `namedRawInvokeRoute` sends `inputs` verbatim as the SAP request body, no field mapping).

### `middleware/server.js`

Append next to the existing SD named routes (around line 583):

```js
// SD — Service Certificate & SO Approvals (raw passthrough; sends inputs verbatim)
namedRawInvokeRoute("/service_certificate/Fetch", "Sevice_Certificate_Fetch");
```

(Note: keep the spelling `Sevice_Certificate_Fetch` to match the Admin → SAP API config name already in the DB.)

User must redeploy / restart the middleware (ngrok box) after this change.

### `src/lib/sd/sc-so-approval.functions.ts`

1. Keep `CONFIG_NAME = "Sevice_Certificate_Fetch"` and proxy slug `/service_certificate/Fetch`.
2. **Remove the `/sap/invoke` fallback** for this function — that fallback was masking the real failure and re-mapping fields. If `/service_certificate/Fetch` returns 404, surface the error so the user knows to update the middleware.
3. Keep the existing `console.log` debug + `debug` response object.

### `src/routes/_authenticated/sd.sc-so.tsx`

No changes.

## Verification

After redeploying middleware:

1. Click **Execute** on Service Certificate & SO Approvals.
2. Server log shows `[/service_certificate/Fetch] ... raw-invoke POST <SAP URL> payload={...all 9 fields...}`.
3. SAP returns the `DATA` array; table populates with rows.

## Out of scope

- No UI changes.
- No change to the SAP API config in Admin → SAP API (the existing `Sevice_Certificate_Fetch` row with its endpoint URL + credentials is reused as-is; the request-field mapping is intentionally bypassed by the raw route).
