## Goal
Stop the selected-plant chip list (`PlantMultiSelect`) from pushing the SELECTION SCREEN grid taller when multiple plants are picked. The Plant cell should keep the same row height as User ID / Customer / Execute, and any chip overflow should expand upward over the field or stay self-contained.

## Diagnosis
In `src/components/sap/plant-multi-select.tsx`, the component renders the popover trigger and a `flex flex-wrap` chip row inside the same `<div className="space-y-2">`. The chip row is part of normal flow, so as more plants are added the Plant grid cell grows and (because the row uses `items-end`) the other fields visually drop. The selected codes are already shown comma-separated inside the trigger button itself, so the chip row is redundant detail rather than the primary readout.

## Change
Edit `src/components/sap/plant-multi-select.tsx` only:

1. Wrap the existing `Popover` + chips in a `relative` container so chip overflow can be positioned out of flow.
2. Render the chip strip as an `absolute` element anchored to the bottom of the trigger and growing upward:
   - `absolute bottom-full left-0 right-0 mb-1`
   - `flex flex-wrap gap-1 justify-start`
   - keep current chip styling (rounded pill, `X` remove button)
   - add a subtle container background (`bg-popover/95 backdrop-blur border rounded-md p-1 shadow-sm`) only when 1+ chips exist, so chips read clearly when they float over the label above.
3. Remove the in-flow `space-y-2` wrapper gap so the trigger height matches sibling inputs exactly.
4. Keep the trigger's truncated comma-separated summary as the always-visible readout — chips become an expandable detail that floats above without resizing the grid row.
5. Cap chip area height with `max-h-24 overflow-y-auto` so an extreme selection doesn't cover the whole form; it scrolls within its own floating area.

No changes to:
- The four SD route files (`sd.contract.tsx`, `sd.price.tsx`, `sd.sales-order.tsx`, `sd.sc-so.tsx`)
- `sd-approval-shell.tsx`
- Server functions, middleware, or DB

## Risk
The floating chip area visually overlaps the `Plant *` label above the trigger when many plants are selected. Acceptable per the user's request ("expand upward … without affecting the layout"); the trigger text still shows the same selection.
