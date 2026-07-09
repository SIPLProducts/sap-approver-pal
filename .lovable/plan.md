## Issue
The login page shows "Middleware forgot route was not found" because the Node middleware (`middleware/server.js`) only exposes `/login/Login_API` — there's no `/login/Forgot_API` route, so our server function's call to `${middleware_url}/login/Forgot_API` returns 404.

## Fix
Add a single raw passthrough route in `middleware/server.js` next to the existing login route:

```js
namedRawInvokeRoute("/login/Forgot_API", "Forgot_API");
```

This uses the same passthrough pattern as `Login_API`, so the payload `{ FORGOT: { EMAIL } }` is forwarded verbatim to SAP.

## After deploy
The Node middleware must be restarted/redeployed for the new route to take effect (as the error message already instructs). No changes needed in the app code — `src/lib/auth/sap-forgot.functions.ts` and `src/routes/login.tsx` already target `/login/Forgot_API`.

## Out of scope
- No changes to login UI
- No changes to server function
- No SAP config changes (the `Forgot_API` entry in SAP API Settings must already exist and be active)
