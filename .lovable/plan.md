## Plan

1. **Add the missing Contract middleware endpoint**
   - In `middleware/server.js`, register:
     - `POST /contract_approval/Contract_Approve_Reject` → `Contract_Approve_Reject`
   - Use the existing raw passthrough route so the payload is sent exactly as the app builds it.

2. **Make middleware console logs visible for every request**
   - Add a small request logger for `/contract_approval/Contract_Approve_Reject` and `/sap/invoke` that prints:
     - incoming URL/path
     - request payload
     - resolved SAP API config name
     - outgoing SAP URL/method
     - SAP response status/body preview
   - Keep secrets redacted (`Authorization`, `x-shared-secret`).

3. **Make the app call the named endpoint directly**
   - Keep Contract approval Accept/Reject targeting:
     - `{middleware_url}/contract_approval/Contract_Approve_Reject`
   - Remove/avoid silent fallback to `/sap/invoke` for this flow unless the named route is unavailable, so your Node console clearly shows the Contract API name.

4. **Clarify browser Network tab behavior**
   - Browser Network cannot show the final SAP private URL directly because the browser only calls the app server function; the app server calls Node middleware; Node middleware calls SAP.
   - The Network tab will show the server-function request/response containing `debug.target`, `request_payload`, `response_status`, and `response_body_preview`.
   - The actual middleware/SAP URL and payload will show in the Node.js terminal after this middleware logging change.

## Expected result

When you click **Accept** or **Reject**, your PowerShell terminal running `node server.js` will print logs like:

```text
[request] POST /contract_approval/Contract_Approve_Reject payload=...
[raw-invoke] Contract_Approve_Reject PUT <SAP URL> payload=...
[raw-invoke] Contract_Approve_Reject PUT <SAP URL> status=200 body=...
```

No database schema or UI layout changes are needed.