## Why the previous fix appears not to work

With middleware redeployed, this is the expected flow:
1. `createZnfa` sends `{ configId, inputs, raw: true }` to `/sap/invoke`.
2. Middleware skips `mapSapResponse` and returns `{ ok, status, data: <raw SAP JSON>, trace }`.
3. Client reads `json.data.OUTPUT` and builds `ZnfaOutput`.

You confirmed the middleware is redeployed and the SAP raw JSON is `{ "OUTPUT": { "PR_NUMBER": ..., "ITEMS": [...], "RATINGS": [...] } }`. That matches the client parser. So something between those steps is silently dropping the payload — either the middleware isn't actually forwarding the raw body, or the client fetch is hitting the non-proxy branch, or an exception is turning it into `error` and the toast is hidden.

I need runtime evidence before changing more logic.

## Step 1 — Add targeted diagnostics (no behavior change)

**`src/lib/mm/gate-process.functions.ts` — `createZnfa` handler**

Right after `text = await res.text()...` and after `json = JSON.parse(text)`, log:
- `proxied`, `useProxy`, `target` (redacted of query string)
- `res.status`, `res.ok`
- `typeof json`, `Object.keys(json)`, `Object.keys(json?.data ?? {})`
- First 500 chars of `text`

Prefix all logs with `[znfa-create]` so they're easy to grep.

Also log the derived `outputRoot`'s keys and `ITEMS.length` / `RATINGS.length` right before `return`.

**`middleware/server.js` — `/sap/invoke`**

Log the parsed `raw` flag once at the top of the handler:
`console.log("[/sap/invoke] raw flag =", raw === true, "skipMapping will be", raw === true);`

## Step 2 — Reproduce and read the logs

1. Redeploy middleware with the extra log line.
2. Trigger a Rating action in the UI.
3. Fetch:
   - `stack_modern--server-function-logs` filtered by `znfa-create` for the app-side view.
   - You share the middleware console for the corresponding request (the `[/sap/invoke] raw flag =` line plus the existing `raw sap body` line).

## Step 3 — Fix based on the evidence

The logs will narrow it to exactly one of:

- **A. `raw flag = false` in middleware log** → client isn't sending `raw: true`. Likely means the deployed app bundle is stale; force a fresh deploy of the app. No code change needed.
- **B. `raw flag = true` but `json.data` has only `pr_number/pr_date/ter_sub_id`** → middleware `skipMapping` branch isn't being taken. Fix `invokeSap` call site / redeploy.
- **C. `json.data.OUTPUT` present in server-fn log but tables still empty** → parsing/rendering bug. Adjust `outputRoot` derivation (e.g. handle a double-wrapped `{data:{OUTPUT:...}}` from the middleware if that turns out to be the shape).
- **D. `res.ok === false` or non-JSON body** → surface the real error message to the toast instead of the current generic one; the fix is to include `text.slice(0,300)` in the returned `error` string.

Only Step 3's chosen sub-fix ships to production. Steps 1–2 are diagnostic and stay in the code briefly; the log lines will be removed once the root cause is confirmed.

## Non-goals

- No UI changes on the ZNFA Rating screen.
- No DB / `sap_api_configs` edits.
