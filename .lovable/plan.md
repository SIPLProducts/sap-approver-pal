## Plan to fix SAP Login API integration

### What is wrong
- `Login_API` is currently configured with `auth_type = basic`, so the app’s login server function takes the direct-SAP branch instead of calling the Node middleware.
- That explains why the request payload is not reaching the Node middleware, even though the same API works in Postman.
- After SAP login succeeds, the app still navigates to `/inbox`, which is protected by backend authentication. A SAP-only success does not currently create a backend session, so the app can still appear to fail or redirect back to login.

### Fix
1. **Force SAP login through middleware when middleware URL is configured**
   - Update `src/lib/auth/sap-login.functions.ts` so `Login_API` uses `POST <middleware_url>/login/Login_API` whenever middleware settings exist, regardless of the API row’s `auth_type`.
   - Keep the SAP payload exactly as expected:
     ```json
     { "inputs": { "LOGIN": { "USER": "...", "PASSWORD": "..." } } }
     ```

2. **Keep direct SAP fallback only when middleware is unavailable**
   - If no middleware URL is saved, only then use the existing direct SAP branch.
   - Improve the returned error so it clearly says whether the failure is middleware auth, middleware route missing, SAP rejection, or direct-SAP failure.

3. **Create a real backend session after SAP login succeeds**
   - When SAP accepts the login, create or reuse a backend auth user for that SAP user ID from the server function.
   - Return a short-lived login token to the browser and have `src/routes/login.tsx` verify it, so the protected `/inbox` route sees a valid backend session.
   - This keeps email/password backend login working for demo/admin users, while SAP user IDs like `SARVI_INFO1` also work.

4. **Clean up the login UI flow**
   - Keep the existing backend email login first for email-shaped IDs.
   - For non-email SAP user IDs, call SAP login, establish the backend session, then navigate to `/inbox` only after the session is active.

5. **Validation**
   - Confirm the login function now logs/calls `/login/Login_API` through middleware.
   - Confirm `/inbox` no longer rejects the user immediately after SAP login.

### Outside-code requirement
- The standalone Node middleware must be restarted/redeployed after code changes if its deployed copy does not already include `/login/Login_API`.