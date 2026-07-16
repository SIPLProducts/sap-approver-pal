
Node's built-in `fetch` (undici) hard-rejects GET/HEAD with a body — that's the error you just saw. Postman works because it uses libcurl, which permits it. So we can't use `fetch` for the GET-with-body case; we need a raw Node HTTP client for that one path.

## Fix — swap the transport, only when it's a GET/DELETE with a body

In `middleware/server.js`, inside `invokeSap` (the single spot that builds the outbound request):

1. Keep the current logic that decides "GET with a non-empty payload → attach JSON body". No change to what we send on the wire.
2. Replace only the outbound call for that one case: instead of `fetchWithTimeout(...)`, use Node's `http` / `https` module to open the request, write the JSON body, and read the response into a `Response`-shaped object (`ok`, `status`, `statusText`, `headers`, `text()`) so the rest of `invokeSap` (raw-body log, `mapResponse`, error handling, timing, `sap_api_sync_log`) stays byte-identical.
3. All other cases (POST/PUT/PATCH, plain GET with empty payload, HEAD) keep using `fetchWithTimeout` — no behavior change.
4. Honor the same timeout as `fetchWithTimeout` via `req.setTimeout(...)` + `req.destroy()`.
5. No changes to UI, `fetchGateProcess`, permissions, DB configs (method stays GET), credentials, response-field mappings, or any other SAP config.

### Verification
- Redeploy middleware.
- Click **Execute** on Gate Process.
- Middleware log should now show `GET ... body={"USER_ID":"SHARVI_RSSPL"}` succeeding with a non-empty response and the Cloudscape table renders the `DATA[]` row.

Approve and I'll make just that one localized change in `middleware/server.js`.
