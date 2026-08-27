# Material Reservation Save — show exact SAP MESSAGE when status is false

## Current state (verified)
- `src/lib/mm/material-reservation.functions.ts` save handler resolves messages in this order:
  1. `MESSAGES: [{ TYPE, MESSAGE }]` arrays (any depth, double-encoded strings handled)
  2. single `TYPE` / `MESSAGE` envelope
- There is **no branch** for the `STATUS: "FALSE"` failure shape. When SAP/middleware returns
  `{ "STATUS": "FALSE", "MESSAGE": "..." }` (or `MSGTXT`) without a `MESSAGES` array, the handler
  falls through to the success path: `TYPE` is empty, so `ok` becomes `true` and the popup shows the
  raw/generic text instead of the exact SAP message.
- `src/lib/mm/sap-message.ts` already has `extractFalseStatusMessage`, which finds a false-status
  envelope at any depth — but it prefers `MSGTXT` over `MESSAGE`.

## Change (minimal, save flow only)
In `src/lib/mm/material-reservation.functions.ts`, after the existing `MESSAGES` block and before the
success block, add a false-status check:

- Detect `STATUS` equal to `FALSE` (case-insensitive, at any depth) in the already-unwrapped/parsed
  `sapJson`.
- Resolve the popup text with **`MESSAGE` first**, then `MSGTXT` — the exact value, untouched.
- Return `{ ok: false, message: <exact text>, documentNumber: <deep DOCUMENT_NUMBER or null> }` and
  log it to `sap_api_sync_log` as `error`, matching the existing logging style.

Add a small helper in `src/lib/mm/sap-message.ts` (e.g. `extractFalseStatusMessagePreferMessage`)
rather than altering `extractFalseStatusMessage`, so the PO/PR screens that rely on `MSGTXT`
precedence keep behaving exactly as today.

## Untouched
- Save payload construction and the API call
- Success handling, list refresh, selection reset, HOD approval/rejection exclusivity
- Fetch flow and every other MM screen
- `SapResponseDialog` component and all other screens' popups

## Outcome
When Save returns a false status, the popup shows only the exact SAP `MESSAGE` text, and the row set
is not treated as saved.
