## Goal
Make the "Approved Qty" column in the Material Reservation items table editable, and include the user-edited value in the Save payload.

## Changes

**`src/routes/_authenticated/mm.material-reservation.tsx`**

1. Extend `RowState` to include `approvedQty: string` (kept as string for input control; parsed to number on save).
2. Seed `approvedQty` from `r.APPROVED_QUANTITY` when rows load (in `onSuccess`).
3. In the columns memo, replace the default cell renderer for `APPROVED_QUANTITY` with a numeric `<Input>` (type="number", right-aligned, ~110px wide, h-8 text-sm) wired to `rowStates` via `updateRow(k, { approvedQty: ... })`, mirroring the Remarks pattern.
4. In `onSave`, use `Number(st.approvedQty ?? r.APPROVED_QUANTITY ?? 0) || 0` for `APPROVED_QUANTITY` instead of reading only from the original row.

## Out of scope
No other columns, no styling changes elsewhere, no server-function changes.
