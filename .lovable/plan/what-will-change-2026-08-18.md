In the Service Entry Sheet screen, reduce the width of the input fields in the PO Data and Entry Sheet Data cards while keeping the existing layout, design, code, logic, and functionality unchanged.

## What will change

Only `src/routes/_authenticated/mm.service-entry-sheet.tsx` will be touched.

The current grid uses `minmax(0, 1fr)` for the From and To input columns, so the fields stretch to fill the available card width. We will cap the input width by changing the grid column sizing to use `minmax(0, 320px)` (or an equivalent max-width utility on the inputs), while keeping the label column at `220px` and the "to" separator between the inputs. The existing fields, labels, PlantSelect components, date inputs, and state logic remain exactly the same.

No other screens, styles, server functions, or routes are modified.
