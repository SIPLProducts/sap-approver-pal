## Goal
Make the Login page succeed when `Login_API` returns a valid business response, and show a useful error only when the SAP/middleware call truly fails.

## What I found
- The app now calls the raw middleware route `/login/Login_API`, so the payload should no longer be stripped by request-field mapping.
- The current app logic only treats the middleware response as success when `body.ok === true`.
- If the middleware/SAP returns HTTP 403 but with a SAP business response body that represents a valid login result, the app currently still treats it as failure because it relies on HTTP `ok/status` instead of parsing the SAP login response shape.

## Plan
1. Update `src/lib/auth/sap-login.functions.ts` response handling for the proxy path:
   - Parse the raw response body safely, whether it is JSON or text.
   - Return `ok: true` when the middleware response is HTTP success OR the SAP response body indicates a successful login.
   - If HTTP 403 is returned but the SAP payload contains a usable login-success response, continue login instead of showing the failure toast.
   - Preserve failure toasts for real middleware failures, network errors, invalid JSON, or explicit SAP login rejection.

2. Add a small helper inside the same server function to detect the login result from common SAP body shapes:
   - direct `{ ok: true }`
   - nested `{ data: ... }`
   - login response objects containing success/status/message fields
   - tolerate string/number status values without crashing

3. Keep the request payload unchanged:
   ```json
   { "inputs": { "LOGIN": { "USER": "<User ID>", "PASSWORD": "<Password>" } } }
   ```

4. Keep the UI unchanged except it will now continue to `/inbox` when the SAP login response is accepted.

5. Add clearer log/toast error text so we can distinguish:
   - middleware unreachable
   - shared-secret/auth problem
   - SAP rejected credentials
   - SAP returned 403 with parseable business response

## Outside-code requirement
After any middleware changes already made, the Node middleware must be restarted/redeployed so `/login/Login_API` is available in the running middleware.