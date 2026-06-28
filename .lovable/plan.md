# Fix: Login_API payload reaches middleware empty

## Root cause

The login server function posts `{ LOGIN: { USER, PASSWORD } }` to the middleware as `inputs`, hitting the generic `/sap/invoke` route. That route calls `invokeSap()`, which **rebuilds** the SAP body via `buildRequestPayload(cfg.requestFields, inputs)` — it only includes fields configured under the API's "Request Fields" tab. The `Login_API` config has no request-field mappings, so the body actually sent to SAP is `{}`. SAP rejects it with `403 / error code 1003`.

The middleware already has a "raw passthrough" pattern (`namedRawInvokeRoute` → `invokeSapRaw`) used by approve/reject endpoints — it sends `inputs` verbatim as the SAP body. We just need to use it for `Login_API`.

Postman works because you send the full body manually; the middleware's mapping step is what strips it.

## Changes

### 1. `middleware/server.js`
Register a named raw route for Login:
```js
// Auth
namedRawInvokeRoute("/login/Login_API", "Login_API");
```
(Place next to the other `namedRawInvokeRoute` calls.) After deploying the middleware, this endpoint will POST the literal `{ LOGIN: {...} }` to SAP.

### 2. `src/lib/auth/sap-login.functions.ts`
In the `auth_type === "proxy"` branch, stop calling `invokeViaMiddleware(cfg.id, payload)` (generic mapped route). Instead, POST directly to the middleware's raw login endpoint:
- Read `middleware_url` from `sap_global_settings` and `proxy_secret` from `sap_global_secrets` (same pattern already used in `invokeViaMiddleware`).
- `fetch(`${middleware_url}/login/Login_API`, { method: "POST", headers: { "Content-Type": "application/json", "x-shared-secret": proxy_secret }, body: JSON.stringify({ inputs: { LOGIN: { USER, PASSWORD } } }) })`.
- Map response: `ok` from body, `status` from body, `error` from body when not ok (include `data` preview so 1003-style SAP errors surface in the toast).

Keep the existing `basic` branch (direct call) unchanged.

## Operator step (outside code)
The user must redeploy/restart the Node middleware after the `server.js` change so the new `/login/Login_API` route is live.

## Out of scope
- No DB/schema changes.
- No change to login UI.
- No change to other SAP APIs.
