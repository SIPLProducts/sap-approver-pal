## Plan

1. **Make SAP Connection the single source of truth**
   - Update `/api/public/middleware/config` so every resolved API config always uses:
     - `sap_global_settings.sap_base_url` for relative endpoint paths
     - `sap_global_settings.sap_username` + `sap_global_secrets.sap_password` for Basic Auth
   - Stop reading `sap_api_credentials.username` and `sap_api_credentials.password_encrypted` for SAP Basic Auth.
   - Keep only `extra_headers` from per-API credentials, because those may still be API-specific.

2. **Fix the admin “Test connection” path too**
   - Update `testSapConnection` so direct tests also use the global SAP Connection username/password, not the per-API credential row.
   - This prevents “Test connection works one way but Execute fails another way.”

3. **Prevent future confusion in the UI**
   - Update the API credentials tab text/behavior so username/password are no longer presented as per-API Basic Auth credentials.
   - Keep the extra headers editor if needed.

4. **Middleware behavior**
   - Keep the Node middleware mostly unchanged: it will receive already-resolved `endpoint_url`, `auth_type`, and global credentials from the app config endpoint.
   - Its `.env` SAP username/password remain fallback/mock-only and should not be required for live mode.

5. **Validation**
   - After implementation, verify the resolved config endpoint returns the global SAP Connection credentials for `Get_Plant`, `Price_Approval_Fetch`, and `Price_Approve_Reject`.
   - Then the middleware execute button should send Basic Auth using the global SAP Connection pair for every API.