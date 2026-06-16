## Problem

When clicking Accept/Reject on Contract Approvals, SAP returns `502 Bad Gateway`. The current server function `submitContractDecision` **throws** an `Error` on any non-OK response (and on network failure). Because it throws:

- The TanStack server-function RPC response becomes an error envelope — the `debug` block (target URL, request payload, response body, latency) is never sent to the browser.
- The client's `onSuccess` handler (which does `console.groupCollapsed([SAP] …)`) never runs, so nothing prints in the console.
- The Network tab shows the RPC call but its response body has no SAP URL/payload — just the error message.

Result: user only sees the toast `SAP returned 502 Bad Gateway: {}` with zero visibility into what was sent.

## Fix

Make request/response details observable on **every** outcome — success, SAP error status, and network failure.

### 1. `src/lib/sd/contract-approval.functions.ts` — `submitContractDecision.handler`

Stop throwing on failures. Instead, always return a structured result with a `debug` block:

```ts
return {
  ok: false,
  action: data.action,
  count: data.rows.length,
  error: "SAP returned 502 Bad Gateway: …",  // human message
  sap_response: json ?? null,
  debug: {
    target, method, proxied,
    request_headers: redacted(headers),   // strip Authorization / x-shared-secret
    request_payload: sapPayload,
    response_status: res.status,
    response_body_preview: text.slice(0, 4000),
    latency_ms,
  },
};
```

Three branches updated:
- Network failure (`catch (e)`) — return `ok:false` with `debug` (no response_status), `error: "Could not reach SAP: …"`.
- Non-OK SAP response (current `if (!res.ok)`) — return `ok:false` with full `debug`, instead of `throw new Error(...)`.
- Success path — unchanged (already returns `debug`).

Add a `redacted(headers)` helper that strips `Authorization` and `x-shared-secret` before returning.

Also bump `response_body_preview` from 2000 → 4000 chars so 502 HTML pages aren't truncated to `{}`.

### 2. `src/routes/_authenticated/sd.contract.tsx` — `decisionMutation.onSuccess`

Handle the new `ok:false` shape:

- Always log the `debug` group (URL, method, request payload, response status, response body) — already done for success, now also runs on failure because handler no longer throws.
- If `res.ok === false`, show `toast.error(res.error)` and **do not** open the success dialog or refetch.
- Keep existing success behaviour when `res.ok === true`.

`onError` still handles true RPC/transport failures (e.g. auth middleware rejecting the call).

### 3. Verify

After the change, clicking Accept with the current 502 should produce in the browser:
- Console: a `[SAP] Contract_Approve_Reject · accepted · 502 (…ms)` group with `URL`, `Method`, `Request payload`, `Response body`.
- Network tab: the `/_serverFn/…submitContractDecision` response JSON body contains the same `debug` block — inspectable via the Response tab.
- Toast: the same `SAP returned 502 …` message, but now diagnosable.

## Files

- `src/lib/sd/contract-approval.functions.ts` — replace 2 throws with structured returns, add header redaction, widen body preview.
- `src/routes/_authenticated/sd.contract.tsx` — branch `onSuccess` on `res.ok`; always log debug group.

No DB, schema, or UI layout changes.
