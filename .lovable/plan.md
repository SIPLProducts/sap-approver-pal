## Goal

Make Sales Order and Contract approval result dialogs match the Price screen's "SAP Response" card layout (screenshot 2), remove the hardcoded "Submitted to SAP" fallback, and surface the full middleware SAP response in logs.

## What changes

### 1. Unified "SAP Response" dialog (Sales Order + Contract)

Currently:
- **Price screen** already renders the card-style dialog with header "SAP Response", a colored banner ("Approved successfully" / "Completed with errors" / "Completed with warnings"), a "SAP Response Details" list of cards (message + Customer line + Success/Error/Warning pill).
- **Sales Order screen** still renders the older row/table layout ("TYPE / CUSTOMER / SO / CONTRACT / MESSAGE" table) — screenshot 1.
- **Contract screen** renders the same older row/table layout.

Action: replace the `ResultDialog` component body in `src/routes/_authenticated/sd.sales-order.tsx` and `src/routes/_authenticated/sd.contract.tsx` with the same JSX used in `sd.price.tsx` (lines 407–530). The summary subtext becomes context-appropriate:
- Sales Order: `"{successCount} of {total} sales order{s} released in SAP"`
- Contract: `"{successCount} of {total} contract{s} released in SAP"`
- Price: existing `"… condition record(s) saved in SAP"` is kept.

Keep the existing tone logic (Success / Error / Warning) and badge colors from Price.

### 2. Remove hardcoded fallback message (dynamic response)

In `sd.sales-order.tsx` the current code injects a fake entry when no `MESSAGE` is parsed:

```ts
[{ TYPE: "@01@", MSG: "Submitted to SAP" } as SapMsg]
```

That is what produces the "S — — Submitted to SAP" row in screenshot 1 even when SAP actually returned messages. Action: remove this fallback. Instead:
- If `msgs.length > 0` → render them (real SAP messages).
- Else if the server returned a non-empty `debug.response_body_preview` → render one card with that raw text and `TYPE: "I"` (Info) so the user sees exactly what SAP sent back, not a fabricated success.
- Else → fall back to a single Info card with the server `error` text (or `"No response body from SAP"`).

Apply the same dynamic extraction (string-`inner` JSON parse + `debug.response_body_preview` fallback already in Sales Order) to `sd.contract.tsx` so it doesn't silently drop a body when `ok === false`.

### 3. Middleware response logging

`middleware/server.js` currently truncates the SAP response body to 500 chars in the named-invoke route and writes only the first 200 chars to `sap_api_sync_log`. The user reports the SAP response is not visible in the middleware logs/UI.

Action in `middleware/server.js` (named-invoke route, ~lines 502–512):
- Build a `fullBody` string of the SAP response (stringify if object) and `console.log` it in full instead of the 500-char preview.
- Pass the full body (capped at ~4000 chars to fit the DB column) into the `sap_api_sync_log.message` field so the SAP Sync Log in the app shows the actual response, not just the status code.
- Same change inside `/sap/invoke` (~lines 458–466) for consistency.

No change to `Sales_Order_Approve_Reject` server function — it already returns `sap_response` and `debug.response_body_preview`.

## Verification

1. Sales Order Approvals → select a row → Approve. Dialog header must read **SAP Response** with a banner ("Approved successfully" or "Completed with errors") and one card per SAP `MESSAGE` entry showing the message text, `Customer: …`, and a colored Success/Error/Warning pill — exactly matching screenshot 2.
2. Contract Approvals → Approve / Reject. Same card layout.
3. With the sample SAP body `{ MESSAGE: [{ CUSTOMER: "1060191", TYPE: "@01@", MSG: "Sales Order Released Successfully-1000500031" }] }`: dialog shows one Success card with that exact MSG and `Customer: 1060191`. No "Submitted to SAP" card appears.
4. Middleware console + SAP API Settings → Sync Log: each Approve/Reject entry shows the full SAP response body, not just `502 …` or a 200-char preview.

## Files touched

- `src/routes/_authenticated/sd.sales-order.tsx` — replace `ResultDialog`, remove hardcoded fallback.
- `src/routes/_authenticated/sd.contract.tsx` — replace `ResultDialog`, add the same robust message extraction + body fallback.
- `middleware/server.js` — log full SAP response body and persist it into `sap_api_sync_log.message`.
