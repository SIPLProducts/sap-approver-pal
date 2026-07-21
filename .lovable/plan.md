## Root cause (confirmed from your middleware log)

- App sends: `{"RELEASE":{"BANFN":"8000000204","BNFPO":"10","REL_CODE":"A1","REL_GRP":"S2","REMARKS":""}}`
- Middleware forwards the exact same JSON to `POST /mm_approve_mng/zgp/zgp?sap-client=300` with the same Basic user (`SARVIINFO`) that works in Postman.
- SAP replies `{"MESSAGES":[{"TYPE":"E","MESSAGE":"No data entered"}]}` — SAP is receiving the request but reading the body as empty.

Payload, URL, method, and auth are identical to Postman. The only thing that differs is the transport: for POST, the middleware currently uses Node's global `fetch` (undici), which does not always emit a `Content-Length` header — this ABAP ICF endpoint (`/mm_approve_mng/zgp/zgp`) reads the request body length from `Content-Length` and treats a missing/chunked body as "No data entered". The GET variant of the same endpoint already works from the middleware because we bypass undici via `rawHttpRequestWithBody`, which sets `Content-Length` explicitly (that path was added earlier for ZNFA).

## Fix scope

Middleware only. No app-side changes, no config changes, no business logic changes.

### `middleware/server.js` — `invokeSap`

- Change `needsRawHttp` so any request that carries a body goes through `rawHttpRequestWithBody`, not just GET/DELETE/HEAD.
  - New condition: `const needsRawHttp = body != null;`
- `rawHttpRequestWithBody` already sets `Content-Length: Buffer.byteLength(body)` when the caller doesn't provide it, so POST/PUT will now include the header the SAP endpoint requires.
- No other invoker (`invokeSapRaw`, health check) needs to change.

### Verification

- Middleware unit tests (`middleware/*.test.js`) — run `bunx vitest run middleware`. No test changes needed; this only alters transport.
- Manual: click Release on a valid PR item; expect the middleware `raw sap body` log to now show the real SAP `[{ "MSGTXT": "...", "STATUS": "..." }]` array (matching Postman), and the app to display the toast + drop the row.

## Notes

- The `PR_Release_API` config stays `POST` (matches Postman).
- The response mapping fix from the previous turn (envelope-preserving `mapSapResponse` + Release success detection) already handles the real SAP response array once transport is corrected — no further app changes.
