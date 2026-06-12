# Fix Price Approve/Reject — 502, visibility, header checkbox

## Root cause of the 502

Server-fn `submitPriceDecision` builds the correct SAP payload `{APPROV, REJ, DATA:[...]}` and POSTs it to middleware `/price_approval/Price_Approve_Reject` as `{ inputs: sapPayload }`.

But the middleware route runs `invokeSap(cfg, inputs)` (middleware/server.js:453), which calls `buildRequestPayload(cfg.requestFields, inputs)` — it discards our `{APPROV, REJ, DATA}` structure and re-builds the body from `cfg.requestFields` (configured for the *Fetch* read, not the write). The result: SAP receives a meaningless body, returns 500, middleware wraps as 502 → frontend toast shows "502 Bad Gateway".

The Approve/Reject endpoint must forward the inputs object **verbatim** as the SAP request body.

## Changes

### 1. `middleware/server.js` — raw passthrough invoker
- Add `invokeSapRaw(cfg, rawBody)` that:
  - Uses `cfg.endpoint_url`, `cfg.http_method` (default `PUT`), `cfg.credentials` for basic auth, plus extra_headers.
  - Sends `JSON.stringify(rawBody)` as the body (no `buildRequestPayload`, no field mapping).
  - Logs `[Price_Approve_Reject] payload=<json>` before send and `status=<n> body=<text 500 chars>` after.
  - Returns `{ ok, status, latency_ms, data }`.
- Change the `/price_approval/Price_Approve_Reject` route to call `invokeSapRaw(cfg, inputs)` instead of `invokeSap`.
- Keep `/price_approval/Fetch` on the existing `invokeSap` path (it relies on field mapping).

### 2. `src/lib/sd/price-approval.functions.ts` — console logs + better error
Inside `submitPriceDecision` handler:
- `console.log("[submitPriceDecision] target=", target, "method=", method, "payload=", sapPayload);`
- After `fetch`: `console.log("[submitPriceDecision] status=", res.status, "body=", text.slice(0, 1000));`
- On error, include the upstream `data` field from middleware in the thrown message so the UI surfaces the real SAP reason instead of an opaque 502.

### 3. `src/routes/_authenticated/sd.price.tsx` — frontend logging + visible network call
- In `decisionMutation.mutationFn`, `console.log("[price-decision] sending", vars)` before the call.
- In `onSuccess`, `console.log("[price-decision] response", res)`. In `onError`, `console.error("[price-decision] failed", e)`.
- Note for the user: server-fn calls appear in **Network → Fetch/XHR** as `POST /_serverFn/...?...submitPriceDecision...`. They are real network requests — filter by `_serverFn` or `submitPriceDecision` to see them. Payload is the JSON request body; response is the JSON response body.

### 4. Header checkbox — match exact rule the user wants
Current logic uses `indeterminate` for partial selection. The user wants strict binary:
- `header.checked = (visible.length > 0 && every row selected)`
- Any row unchecked → header unchecked (no indeterminate icon).

Replace:
```
checked={allChecked ? true : someChecked ? "indeterminate" : false}
```
with:
```
checked={allChecked}
```
`toggleAll` stays the same (selects all visible when header was off, clears all when on). With `allChecked` driven by selection state, single-row select shows header as unchecked, and ticking the last row flips header to checked automatically.

## Notes / non-changes
- The Accept button color (green) and the API wiring stay as in the last turn.
- No DB / schema changes.
- After this lands the user must restart their local `middleware/server.js` to pick up the raw-passthrough route.

## Files
- `middleware/server.js`
- `src/lib/sd/price-approval.functions.ts`
- `src/routes/_authenticated/sd.price.tsx`
