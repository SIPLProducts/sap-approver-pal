
Understood — you've confirmed Postman is set to **GET** and it still returns the data. That means SAP's `znfa_ter` service reads `USER_ID` from the JSON **body** even on a GET request. Our middleware currently:

- On GET → puts params in the query string, sends no body.
- On POST → puts params in the JSON body.

That's why Postman (GET + body) works and our app (GET + query string) returns `"No Data Available"`.

## Fix — revert method, teach middleware to send GET-with-body

1. **Revert the DB change**
   - `sap_api_configs.http_method` for `Gate_Pass_Fetch_API`: `POST` → `GET` (back to original).

2. **Small change in `middleware/server.js`** (single spot inside the shared SAP invoke pipeline used by `/sap/invoke` and `/gate_pass/Fetch`):
   - When `http_method === 'GET'` and there is a non-empty request payload (from `sap_api_request_fields`), send the payload as a **JSON body** on the GET request (`Content-Type: application/json`) instead of appending it to the query string.
   - When `http_method === 'GET'` and the payload is empty, keep today's behavior (plain GET, no body).
   - POST / PUT / PATCH / DELETE behavior is untouched.
   - This uses Node's `fetch` (undici), which does support a body on GET when explicitly set — same wire shape Postman produces.

3. **No other changes** — no UI change, no change to `fetchGateProcess`, permissions, credentials, response-field mappings, or any other SAP config. Every other config today has an empty payload on GET, so their behavior is unchanged.

### Verification
- Redeploy the middleware.
- Click **Execute** on Gate Process.
- Middleware trace should now show `method=GET body={"USER_ID":"SHARVI_RSSPL"} rows=1` and the Cloudscape table renders the `DATA[]` row with the mapped columns (`check`, `Purchase Requisition Number`, `Request for Quotation Number`, `RFQ title`, `Vendor name`, `Tender Submission ID`).

Approve and I'll revert the DB flag and make the one middleware edit.
