# Fix Material Reservation save message + ZNFA attachment middleware response

## 1. Material Reservation — show the exact SAP MESSAGE on failure

Today the save handler only looks for `MESSAGES` at the top level of the SAP
response object. When SAP wraps the response (array form, or nested inside the
middleware envelope) the check misses it and the popup shows a generic
"Save failed" / status text instead of the real text.

Change: in `src/lib/mm/material-reservation.functions.ts`, resolve the message
with the existing shared helpers in `src/lib/mm/sap-message.ts`
(`extractMessagesArrayError` / `collectSapMessages`, which search recursively),
so shapes like:

```text
{"MESSAGES":[{"TYPE":"E","MESSAGE":"Approved quantity exceeds available stock"}]}
[{"MESSAGES":[{"TYPE":"E","MESSAGE":"..."}]}]
```

all resolve to the exact `MESSAGE` value, with `ok: false` when any `TYPE` is
`E`/`A`. The Swal popup already renders `res.message`, so no UI change is
needed — the popup will show only the SAP text. Success shape handling,
payloads, list refresh and selection reset stay exactly as they are.

## 2. ZNFA Release — attachment API response not coming back through middleware

Cause (verified in code): the attachment call posts an **array** as `inputs`:

- `src/lib/mm/znfa-attach.server.ts` sends `{ configId, inputs: [ {...} ], raw: true }`
- `middleware/server.js` `/sap/invoke` validates `inputs` with
  `z.record(z.string(), z.unknown())` (object only) and then rebuilds the SAP
  body from the configured request fields.

So the array either fails validation or is reshaped, which is why the same
payload works in Postman but returns nothing through the middleware. Every
other working ZNFA call sends an object.

Fix (verbatim array passthrough, no change to existing routes):

- `middleware/server.js`: accept an array body for a raw invoke. Add a small
  route `POST /sap/raw-invoke` guarded by the same `x-shared-secret`, taking
  `{ configName | configId, inputs }` where `inputs` may be an array or object,
  and forwarding it verbatim through the existing `invokeSapRaw()` helper
  (unmasked response, `safeParseSapJson`, sync log). Existing `/sap/invoke`
  and all named routes are untouched.
- `src/lib/mm/znfa-attach.server.ts`: when proxy mode is on, call
  `/sap/raw-invoke` with the array payload instead of `/sap/invoke`, and keep
  unwrapping `result.data` as it does now. Direct (non-proxy) mode is unchanged.

Attachment list rendering, single-select behaviour, the `OBJDES` hyperlink and
the `ZNFA_ATTACH_PRINT_API` preview dialog stay as-is — only transport changes.

## Deployment note

The middleware runs as a separate self-hosted service, so the ZNFA attachment
fix only takes effect after the middleware container is redeployed with the new
`middleware/server.js`. The Material Reservation fix is app-side and takes
effect immediately.

## Technical summary

- `src/lib/mm/material-reservation.functions.ts` — recursive SAP message
  extraction for the save response.
- `middleware/server.js` — new `/sap/raw-invoke` route (array-safe verbatim
  passthrough via existing `invokeSapRaw`).
- `src/lib/mm/znfa-attach.server.ts` — proxy calls target `/sap/raw-invoke`.
