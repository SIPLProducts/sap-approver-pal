## Goal

The SAP Forgot API returns the real password in Postman (`[{ "ZUSER":"SARVI", "ZPASSWORD":"Chaitu@071", "ZSTATUS":"ACTIVE" }]`), but the recovery email shows `********`. Find where the value is being lost and preserve the exact SAP value end-to-end.

## Findings so far

- `middleware/server.js` has **only one** masking site: line 481, inside the outbound request log for `invokeSap`. It runs on a deep clone (`JSON.parse(JSON.stringify(payload))`) of the *request payload*, not the SAP response, and only mutates the clone that is passed to `console.log`. It does not touch the value the middleware returns.
- Forgot uses `namedRawInvokeRoute("/login/Forgot_API", "Forgot_API")` → `invokeSapRaw`, which never calls `mapResponse` and never masks. It returns `{ ok, status, latency_ms, data }` with `data` = parsed SAP body verbatim.
- The middleware's response body log (`[raw-invoke] ... raw=`) is truncated to `text.slice(0, 500)` — so on a longer array response the operator sees a cut-off preview, which can look like the value was altered.
- The app-side `findFieldValue` in `src/lib/auth/sap-forgot.functions.ts` already walks arrays and nested objects, so it will find `ZPASSWORD` inside `data[0]` from the middleware envelope. No masking happens on the app side either.

Conclusion: the most likely real causes are (a) a stale middleware deployment, (b) truncated middleware logs being misread as masking, or (c) the SAP response actually reaching the app but the array-wrapped envelope tripping a code path we should harden. The plan below fixes all three deterministically and adds unmasked, full-body diagnostics so the next test is unambiguous.

## Changes

### 1. `middleware/server.js` — prove the response is not masked

- In `invokeSapRaw`, replace the two `text.slice(0, 500)` / `JSON.stringify(data).slice(0, 500)` log lines with **full** unmasked logs for the Forgot flow (log the entire `text` and entire `JSON.stringify(data)`), so operator can see the exact SAP payload the middleware received and returned.
- Narrow the request-log masking in `invokeSap` (line 475–486) so it only masks keys on the immediate request payload (already the case), and add a comment clarifying that this never touches the response. No behavior change to responses — just makes intent explicit.
- Add a version banner line at boot (`console.log("[middleware] build=<git sha or timestamp>")`) so we can confirm the running middleware is the latest one when the user retests.

### 2. `src/lib/auth/sap-forgot.functions.ts` — harden extraction + log the raw value

- After receiving the middleware response, unwrap `responseBody.data` when it's an array or object (SAP returns a bare array; middleware wraps it as `{ ok, status, data: [...] }`). Feed the unwrapped payload into `findFieldValue` first, then fall back to the full envelope. This guarantees `ZPASSWORD` is picked from `data[0]` even if SAP later moves fields around.
- Add a server-side debug log (redacted only for email, full for password length + first/last char) right before `buildCredentialsEmail` is called, e.g. `console.log("[sap-forgot] zpassword length=", zpassword.length, "first=", zpassword[0], "last=", zpassword.at(-1))`. This lets us confirm the exact SAP value reached the mailer without ever writing the full password to persistent logs.
- Confirm `buildCredentialsEmail` renders `fields.zpassword` verbatim (per-character spans already in place from the previous change) with no `.replace(/./g, "*")` or similar anywhere in the chain.

### 3. Verification

- Rebuild + redeploy the Node middleware (the user must restart the middleware service — noted in the reply — otherwise old code keeps masking in their memory of it).
- Trigger a forgot-password from the login page.
- Inspect middleware console:
  - `[request] body=` — the `{ inputs: { zmail: "..." } }` sent by the app.
  - `[raw-invoke] ... raw=` — full unmasked SAP response array with real `ZPASSWORD`.
- Inspect app server-function log:
  - `[sap-forgot] zpassword length=… first=… last=…` — matches the Postman value's length and endpoints.
- Open the delivered email and confirm the Temporary Password row shows the exact SAP value (e.g. `Chaitu@071`).

## Out of scope

- SAP field mapping, auth, SMTP config, subject line, CC list, logo, or plain-text body — unchanged.
- Client-side login/forgot UI — unchanged.
