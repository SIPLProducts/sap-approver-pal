# Service Entry Sheet layout compactness

Make the Service Entry Sheet selection screen more compact by removing the empty space after the To fields, placing the two large data cards side by side on wide screens, and arranging the three small option cards in a single row.

## What changes

Only `src/routes/_authenticated/mm.service-entry-sheet.tsx` will be modified.

### Remove trailing space after To fields
In the `RangeRows` component, each row is a full-width grid. This leaves unused space after the To input. We will add `sm:w-fit` so the row width matches its actual content (label + From + to + To), eliminating the trailing gap while keeping the columns aligned across rows.

### PO Data and Entry Sheet Data side by side
Wrap the two cards in a responsive grid:

```text
+------------------+------------------+
|   PO Data card   | Entry Sheet Data |
|                  |      card        |
+------------------+------------------+
```

On screens below `lg`, the cards still stack vertically. On `lg` and above, they sit side by side to reduce vertical scrolling.

### Blocking, Acceptance, and Scope of List in one row
Wrap the three smaller cards in a responsive grid:

```text
+-------------+-------------+-------------+
|   Blocking  |  Acceptance | Scope of List |
|  Indicator  |  Indicator  |    card       |
+-------------+-------------+-------------+
```

On smaller screens they stack vertically. On `lg` and above they appear in one row, each taking a reduced share of the width.

## What stays the same

- All input fields, labels, PlantSelect components, date inputs, radio options, and the Scope of List input remain unchanged.
- The `RangeRows` column sizing (label 220px, From/To inputs max 140px, gap-1) remains unchanged.
- Card padding, colors, typography, and button styling remain unchanged.
- State logic, API calls, Execute/Reset behavior, results table, row selection, Release/UnRelease/Delete actions, and message dialogs remain unchanged.
- No other files, routes, server functions, or database changes are introduced.

## Technical details

- Change `RangeRows` grid className to include `sm:w-fit` (or `sm:max-w-fit`) while keeping the existing `grid-cols-1 sm:grid-cols-[minmax(0,220px)_minmax(0,140px)_auto_minmax(0,140px)]` definition.
- Wrap the PO Data and Entry Sheet Data `<Card>` elements in a parent `<div className="grid gap-4 lg:grid-cols-2">`.
- Wrap the Blocking Indicator, Acceptance Indicator, and Scope of List `<Card>` elements in a parent `<div className="grid gap-4 lg:grid-cols-3">`.
- The Release card remains full-width above the data cards.
- The Results table remains below the selection cards, unchanged.

## Verification

- Open the Service Entry Sheet screen and confirm the empty space after the To fields is gone.
- On a large viewport, confirm PO Data and Entry Sheet Data cards appear side by side.
- On a large viewport, confirm Blocking Indicator, Acceptance Indicator, and Scope of List cards sit in one row.
- Resize to smaller viewports and confirm the cards stack vertically without clipping fields.
- Run typecheck and `build:dev` to confirm no regressions.
