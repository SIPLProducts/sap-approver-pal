## What the logs actually show

- App-side sync log for `Gate_Pass_Fetch_API`:
  `invoke: 200 {}` (latency 88 ms) followed by `gate-fetch: 200 OK` with `rows_processed = 0`.
- Middleware trace line: `response_bytes=35 rows=n/a json_repaired=false`, then `body= {}`.

`rows=n/a` means SAP's JSON is a plain object, not `{ DATA: [...] }` / `{ data: [...] }` / `[...]`. Because the `Gate_Pass_Fetch_API` row has six response-field mappings (`DATA[].CHECK`, `DATA[].PR_NUMBER`, …), the middleware falls into the object-mapping branch and stringifies to `{}` (all target columns resolve to `undefined`).

So SAP is answering the GET with a **35-byte JSON payload that does not contain a `DATA` array**. It's HTTP 200 and JSON, just not the rows Postman is seeing. The Postman call with the same URL clearly reaches a state that returns the rows, so the two callers are not equivalent — but nothing in the current middleware log tells us in what way.

## Fix

Do not change:

- The DB config (`http_method` stays `GET`, endpoint URL, auth type, credentials, request/response field rows).
- The `fetchGateProcess` server function.
- The Gate Process UI, permissions, and routing.
- SAP request shape (still `GET …?sap-client=300&USER_ID=<id>`).

Make two additive, log-only changes in `middleware/server.js`:

1. **Log the raw SAP body pre-mapping.** In `invokeSap`, right after
   `const text = await res.text().catch(() => "")` and before `mapResponse` is called,
   emit one extra `console.log` with the full raw text (capped to 2000 chars) plus the
   final resolved URL and Basic-auth username. Nothing else in `invokeSap` changes; the
   return shape stays the same, so `mapResponse` and the app-side parsing (`json.data → DATA[]`)
   behave identically.

2. **Add a named alias for cleaner logs.** Register
   `namedInvokeRoute("/gate_pass/Fetch", "Gate_Pass_Fetch_API");` alongside the other
   `namedInvokeRoute(...)` calls. The `fetchGateProcess` function already tries this
   path first and only falls back to `/sap/invoke` on 404; wiring the alias just makes
   the middleware print `[/gate_pass/Fetch] …` instead of `[/sap/invoke] …`. No route
   contract changes.

Nothing else moves. Redirects, timeouts, header set, method, credentials, response-field mapping — untouched.

## Verification (post-deploy of middleware)

1. In the app, click **Execute** on Gate Process with the same `USER_ID` used in Postman.
2. Read the new middleware line — `[/gate_pass/Fetch] raw sap body (35b) = …` — and compare it byte-for-byte with the Postman response for the same URL / same user / same Basic-auth credentials.
3. The diff will tell us exactly which of the following the real cause is, all of which are external to the app code:
   - SAP is returning an authorization/error envelope (different user in Postman).
   - SAP returns the row set under a wrapper key we're not yet unwrapping.
   - SAP is empty for the SAP user id the app is sending.
4. Once we can see SAP's actual bytes, the follow-up fix is targeted to that shape without touching business logic.

## Out of scope

- Any change to `sap_api_configs.http_method`, `endpoint_url`, or credentials.
- Any change to Gate Process UI, MM/SD approval flows, or permissions.
- Any change to `mapResponse` behavior for other APIs.
