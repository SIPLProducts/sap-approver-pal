# Gate Pass selection UI polish

## What we'll change

1. **Reduce Gate Pass Number field width**
   - In `src/routes/_authenticated/mm.gate-pass.tsx`, add a compact width class (e.g. `max-w-[260px]`) to the `<GatePassNumberSelect>` so it no longer stretches across the full grid column.

2. **Convert approval checkboxes to inline radio buttons**
   - Replace the five separate checkbox blocks (HOD Approval, Store Approval, SCM Head, Plant Head, Return Receipt) with a single horizontal `RadioGroup` from `@/components/ui/radio-group`.
   - Each option shows a radio circle plus its label, arranged in one row with tight spacing and proper vertical alignment.
   - The row will wrap only on very small viewports to avoid overflow.

3. **Preserve existing single-select / clear behavior**
   - Keep the current `flag` state and `pickFlag`/`setFlag` logic exactly as-is.
   - Add a small click toggle on each radio item: if the user clicks the already-selected option, clear the selection (`setFlag("")`). This matches today's checkbox behavior (only one selected, clicking again clears it).
   - The F4 payload mapping and the `Gate_Pass_Doc_F4_API` trigger remain unchanged.

4. **Keep everything else untouched**
   - No changes to server functions, Execute/Reset/Save logic, table rendering, field locking, or response dialogs.

## Assumptions

- The radio options will render in a single horizontal row inside the existing selection card.
- Gate Pass Number width will be capped at approximately `260px`. If you prefer a different width or a stacked radio layout, let me know and I will adjust.
