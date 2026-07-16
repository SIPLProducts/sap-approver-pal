
## Diagnosis (definitive, from your own logs)

Middleware log shows SAP is being called as:

```
GET  http://10.150.150.154:8103/mm_approve_mng/znfa_ter/znfa_ter?sap-client=300&USER_ID=SHARVI_RSSPL
→ 200  "No Data Available for given Entry"   (35 bytes)
```

Postman, which works, sends the **same URL** but with the parameter in the **JSON request body**:

```
payload: { "USER_ID": "SHARVI_RSSPL" }
→ 200  { "DATA": [ { ... } ] }
```

So the SAP service `znfa_ter` reads `USER_ID` from the request body, not from the query string. When we put `USER_ID` on the URL, SAP treats it as "no filter" and returns the 35-byte "No Data Available" string — which is why the table stays empty even though the HTTP status is 200.

Nothing is wrong with permissions, the UI, `fetchGateProcess`, the response-field mapping, or the middleware pipeline. The only problem is *how* the parameter is being transported to SAP.

## The catch

Postman is almost certainly sending this as **POST** (a GET with a JSON body is non-standard and most HTTP stacks — including `fetch` inside our middleware — will not attach a body to a GET). To match Postman byte-for-byte we need to send the request with a JSON body, which in practice means switching the method to POST.

You've asked me not to change the API method. I want to confirm before touching anything, because the log is unambiguous: as long as `USER_ID` is on the query string, SAP returns "No Data Available". There is no third option that reproduces Postman's behavior without putting `USER_ID` into the JSON body.

## Proposed fix (single, minimal change — awaiting your OK)

1. **DB-only change** on the `sap_api_configs` row `Gate_Pass_Fetch_API`:
   - `http_method`: `GET` → `POST`
   - No other column changes.
2. Existing `sap_api_request_fields` row (`USER_ID`, source=`column`, required) is already correct — once the method is POST, the middleware's existing `buildRequestPayload` puts it into the JSON body, exactly like Postman.
3. No code changes to `fetchGateProcess`, the Gate Process route, permissions, middleware routing, credentials, or any other approval flow.

### Verification
- Redeploy nothing. Just click **Execute** on Gate Process.
- Middleware log should show `body= {"USER_ID":"SHARVI_RSSPL"}` and `rows=1` (for SHARVI_RSSPL).
- The Cloudscape table renders the `DATA[]` row with columns `check`, `Purchase Requisition Number`, `Request for Quotation Number`, `RFQ title`, `Vendor name`, `Tender Submission ID` (already mapped in `sap_api_response_fields`).

### If you truly want the method to stay `GET`
The only alternative is to have the middleware attach a JSON body to a GET request specifically for this config. That works against `fetch` semantics and against how every other SAP config in the app is transported — it would be a special-case branch in `middleware/server.js` just for `Gate_Pass_Fetch_API`. I don't recommend it, but I can do it if you confirm Postman is really sending GET-with-body (please check the method dropdown in Postman before we go that route).

**Please confirm:** may I flip `http_method` to `POST` for `Gate_Pass_Fetch_API` only? Nothing else changes.
