In the Service Entry Sheet screen, narrow the input fields in the PO Data and Entry Sheet Data cards and tighten the horizontal gaps so the layout looks more compact and aligned.

## What will change

Only `src/routes/_authenticated/mm.service-entry-sheet.tsx` will be touched.

The `RangeRows` component uses a grid with:
- Label column at `minmax(0, 220px)`
- From input column at `minmax(0, 180px)`
- An `auto` "to" separator
- To input column at `minmax(0, 180px)`
- A `gap-2` gap between all columns

We will reduce the From and To input columns to `minmax(0, 140px)` and reduce the gap to `gap-1` (or equivalent `gap-x-1`) while keeping the label column at `220px` and the "to" separator in place. This keeps the fields from stretching and makes the spacing between the label, inputs, and separator tighter and more aligned.

The existing fields, labels, PlantSelect components, date inputs, state logic, and overall layout remain exactly the same. No other screens, styles, server functions, or routes are modified.
