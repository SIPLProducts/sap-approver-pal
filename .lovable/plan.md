# MIGO — editable Entry Quantity in Release mode

## Change

In `src/routes/_authenticated/mm.migo-release.tsx`, the Entry Quantity column (`ENTRY_QNT`) is
currently rendered as read-only text. Make it an editable numeric input, but only when the
Transaction Type is **Release**.

- Add a key check helper for `ENTRY_QNT` / `ENTRYQNT` / `MENGE`.
- In the column builder, render an `Input` for that key:
  - value from the existing per-row edit map (same pattern as Storage Location)
  - `disabled` when Transaction Type is Display or Cancel
  - right-aligned, same compact styling as the other editable cells (`h-8 text-xs`)
  - digits and a single decimal point allowed; updates go through the existing `updateCell`
- Because edits are already merged into the payload in `onPost`, the modified quantity is sent
  to SAP without any change to the post logic.

## What stays the same

- `fetchMigo`, `checkMigo`, `postMigo`, `cancelMigo` and their payload shapes.
- Field labels, column order, row selection, header and custom-field cards.
- Display mode stays fully read-only; Cancel mode behaviour unchanged.
- No validation added or removed.

## Verification

- Typecheck.
- Release mode: Entry Quantity is typeable, edited value appears in the Post payload.
- Display mode: Entry Quantity is not editable.
