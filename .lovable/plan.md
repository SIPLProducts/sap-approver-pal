# Price Master Update — editable fields in Update mode

Make three columns editable after an Update-mode fetch, and add an Update button above the results table. UI only; no API call yet.

## Behaviour

- After Update + Execute returns rows, every row shows editable inputs for:
  - Price
  - ZWB02 Price
  - Price Remarks (text input styled like the PR Release Remarks field)
- In Display mode, all three stay read-only exactly as today.
- Edits are held in screen state and survive paging/searching within the table; Reset and a new Execute clear them.
- An Update button appears at the top-right of the results table (same header row as the title/count), only in Update mode with rows present. It is present but performs no API call yet — the update API can be wired once its details are provided.

## What stays the same

- Selection card, radios, credential popup, checkboxes, column order/labels, date and amount formatting, permissions, route, and the fetch server function are unchanged.
- No other screen or shared component changes.

## Technical notes

- `src/routes/_authenticated/imw.price-master.tsx` only:
  - Add `edits: Record<string, { PRICE?: string; PRICE_WB02?: string; PRICE_REMARKS?: string }>` state keyed by row key (`String(index)`), cleared in `reset()` and in the mutation's `onSuccess`/`onError`.
  - In the `columns` memo, when `mode === "update"` and rows are loaded, render `Input` (from `@/components/ui/input`) for `PRICE`, `PRICE_WB02` (right-aligned, numeric-ish, `inputMode="decimal"`) and `PRICE_REMARKS` (same compact `h-8 text-xs` styling used for PR Release Remarks), falling back to the current `renderCell` output otherwise.
  - Row key for edits comes from the same `rowKey` function already passed to `CloudscapeApprovalTable`.
  - Pass `headerExtras` (existing prop on `CloudscapeApprovalTable`) with the Update button so it renders top-right of the table header; no changes to the table component.
