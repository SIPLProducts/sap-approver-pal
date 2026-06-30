## Goals

1. **Plant multi-select**: keep selected values inside the trigger at a fixed height (no floating overlay, no row growth) — values scroll horizontally inside the field so the grid never shifts.
2. **BMW Status Report**: split Sales Organization into two separate fields (From / To) and lay out the selection screen as a clean 4-column grid.

## Changes

### 1. `src/components/sap/plant-multi-select.tsx`
- Remove the absolute floating chip strip (lines 93–113 wrapper + chip block).
- Keep the trigger `Button` at `h-9`, but render the selected values as a single-line horizontally scrollable strip inside the trigger:
  - Replace the `<span className="truncate text-left">{value.join(", ")}</span>` with a `<div className="flex-1 min-w-0 overflow-x-auto whitespace-nowrap no-scrollbar text-left font-mono pr-2">` containing comma-separated codes.
  - Keep `ChevronsUpDown` icon as `shrink-0` on the right so it stays anchored.
  - Stop the wheel/drag from toggling the popover by adding `onClick`/`onPointerDown` `stopPropagation` only on the scroll strip when there are many items — simplest: leave the click behavior (clicking the trigger still opens popover) and just allow horizontal wheel/touch scroll inside.
- Drop the outer `relative` wrapper; component returns the `Popover` directly so it occupies exactly one grid cell with no extra height above.
- Net effect: the field never grows, the grid row never moves, and a user can horizontally scroll through all selected codes inside the input. Removal is still possible by re-opening the popover and unchecking — matches standard combobox UX.

### 2. `src/routes/_authenticated/sd.bmw-status.tsx`
Rework the selection-screen grid to four columns with two distinct Sales Organization fields:

```text
Row 1: [Sales Org From *] [Sales Org To *] [Customer From] [Customer To]
Row 2: [Contract From   ] [Contract To   ] [Selection Type ............]
Row 3: [Execute] [Reset]   (right-aligned action bar)
```

- Replace the single `PlantMultiSelect` (spanning all columns) with **two single-value pickers** — reuse the existing `PlantSelect` component (already in the project) for `Sales Org From` and `Sales Org To`. Each occupies one grid cell.
- Remove the derived `salesOrgFrom` / `salesOrgTo` `useMemo` (no longer derived from a list) and replace with two `useState<string>` values, sent directly to the server fn.
- Update the grid container to `grid gap-3 md:grid-cols-2 lg:grid-cols-4 items-end`, with the Selection Type radio group placed inline as a cell spanning `lg:col-span-2` on row 2.
- Move Execute / Reset into a dedicated action row at the bottom of the card (right-aligned with `flex justify-end`), so the input grid stays a clean 4-column layout.
- Validation: require both `salesOrgFrom` and `salesOrgTo` (toast errors if missing). Payload mapping in the server fn is unchanged — it already accepts `sales_org_from` / `sales_org_to`.

### 3. Other SD approval screens
The Plant multi-select fix in step 1 automatically resolves the "grid disturbance when selecting multiple plants" issue across `sd.contract.tsx`, `sd.price.tsx`, `sd.sales-order.tsx`, and `sd.sc-so.tsx` — no edits needed in those files because they all consume the same `PlantMultiSelect`.

## Out of scope
- No server-function / payload changes (`bmw-status-report.functions.ts` already accepts separate from/to values).
- No DB or migration changes.
- No styling changes beyond layout.

## Risk
- Horizontally scrolling inside a button trigger is uncommon UX; clicking still opens the popover, which is the expected combobox behavior. Removing chips means users can't click an `X` on each chip — they remove via the popover checklist instead.