## Goal

Wire the **Reject** button on the PO Release screen to call `PO_REJECT_API` with the new simplified payload (one call per PO), and show the exact SAP response message in the same popup used by Release — displaying only the message text, not the key names.

## Current state (verified this turn)

- `src/lib/mm/po-release.functions.ts` already has `rejectPoItems` → `processPoAction("REJECT", …)`. Today the REJECT branch builds `{ REJECT: { EBELN, EBELP, REL_CODE, REL_GRP, REMARKS } }` per line item.
- Release was just refactored to be header-level (one call per `EBELN`) and to return `response`, `MSGTXT`, `STATUS`, `RELSTATUS`, `INDICATOR` on each `PoReleaseResult`.
- `src/routes/_authenticated/mm.po-release.tsx` opens a response dialog for Release results and shows a table with MSGTXT / STATUS / RELSTATUS / INDICATOR columns plus raw JSON.
- Reject currently only toasts; there is no popup and no shared response viewer.

## Required payload / response (per user)

- Request: `{ "REJECT": { "EBELN": "<po>", "REMARKS": "<text>" } }` — one call per PO (no `EBELP`, no `REL_CODE`, no `REL_GRP`).
- Response: `[ { "MSGTXT": "PO Rejected Successfully", "STATUS": "TRUE" } ]` (no `RELSTATUS` / `INDICATOR` for reject).

## Changes

### 1. `src/lib/mm/po-release.functions.ts` — reject payload becomes header-level

- In `processPoAction`, treat `REJECT` the same way as `RELEASE`: dedupe selected rows by `EBELN`, then send `{ REJECT: { EBELN, REMARKS } }` once per PO.
- Report the resulting `PoReleaseResult` (with `response`, `MSGTXT`, `STATUS`) back against every selected `EBELP` under that PO so the UI clears all matching rows on success.
- Keep the existing success detection (`STATUS === "TRUE"` already handled). No new fields required — `RELSTATUS` / `INDICATOR` will simply be `undefined` for reject and won't be shown.

### 2. `src/routes/_authenticated/mm.po-release.tsx` — reject popup + message-only display

- Route the reject mutation's `onSuccess` into the same `responseDialog` state used by Release, with an action label of "Reject". Keep the row-removal + refetch behavior.
- Change the dialog body so it does **not** show field names (MSGTXT / STATUS / RELSTATUS / INDICATOR). For each PO show:
  - PO Number (heading).
  - The response **message** text only (prefer `MSGTXT`, fall back to `msgtxt` / `error`), rendered as a single line/paragraph.
  - Keep the collapsible "Raw response" block (unchanged) so the exact SAP JSON is still available on demand.
- No changes to toasts or the results table besides removing successfully rejected rows (already in place).

## Out of scope

- No changes to `PO_Get` or `PO_Release` payloads (Release payload was already updated in the previous turn).
- No middleware changes; existing `/sap/invoke` proxy path is reused.
- No schema/RLS changes.