# ZNFA Rating — TYPE "E" popup for Rating / Change / Display / Attachments

Today the Execute (fetch) call already detects a `TYPE: "E"` response and shows the exact `MSG`
value in the ZNFA Rating popup. The four row actions (Rating, Change, Display, Attachments) do not:
their response is mapped straight into output/items/ratings, and any error text surfaces as a small
toast instead of the popup.

## Behaviour after the change

Select a row, click Rating / Change / Display / Attachments:

- If the response contains `TYPE: "E"`, a popup shows only the exact `MSG` value — no prefixes,
  no raw JSON, no toast.
- No output card, items, ratings or attachments are rendered for that response; existing output
  state is cleared.
- Any other response keeps today's behaviour exactly.

## Technical notes

`src/lib/mm/gate-process.functions.ts` (`createZnfa` handler)
- After `sapJson` is parsed and before `outputRoot` mapping, call the existing
  `extractTypeEErrorMessage(sapJson)` helper (already imported in this file).
- When it returns a message: write an error row to `sap_api_sync_log` (keeping the response
  preview for debugging) and return `{ output: null, error: <exact MSG> }`.
- Leave the rest of the mapping untouched.

`src/routes/_authenticated/mm.gate-process.tsx` (`createMutation.onSuccess`)
- Replace the `toast.error(res.error)` branch with: clear `output`, `items`, `ratings` and
  `lastAction`, then `setMessageDialog({ open: true, message: res.error })` — reusing the existing
  ZNFA Rating dialog already rendered on the page.
- Success path, scroll behaviour and all other logic stay byte-identical. `onError` (network/thrown
  errors) keeps its toast.

No database, RLS, payload or UI-design changes.
