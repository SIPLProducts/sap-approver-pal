## Goal

Change the **Search Term** field so it presents as a normal text input (comma-separated codes), with an adjacent **F4** helper button that opens a popup. The popup fetches values from the `Get_Search_Term` API (configured in Admin → SAP API Settings) and lets the user pick one or more codes; on confirm, the selections are written back into the input (merged with anything the user typed).

## Why the F4 wasn't visible

The current `SearchTermMultiSelect` renders as a `<Button>`-styled combobox trigger. It looks like a dropdown, not a text field, and users don't recognise a click target for F4. Requirement is: the field itself stays an editable input, and F4 help is a separate affordance.

## Changes

### 1. Rework `src/components/sap/search-term-multi-select.tsx`

Replace the trigger with an input group:

```
[  input (comma-separated codes)                ] [ F4 ]
```

- `<Input>` bound to `value.join(", ")`; onChange splits on comma/whitespace, trims, dedupes.
- `<Button>` labelled "F4" (small, `variant="outline"`, keyboard shortcut: F4 while input is focused) opens a `<Popover>`.
- Popover content is the existing multi-select list (Command + Checkbox items, "Select all / Clear", search box, loading / error / empty states) — unchanged behaviour.
- On popup open, seed local selection from current `value`. On **Apply**, call `onChange(mergedCodes)` and close. On **Cancel**, discard.
- Keep the config-missing fallback (plain input), but drop the F4 button in that case (no API to call).
- Keep the tolerant key extractor (`SORTL` / `SEARCH_TERM` / `SEARCHTERM` / …) and the plant-context inputs already implemented.

### 2. No changes required in the three screens

`sd.contract.tsx`, `sd.sales-order.tsx`, `sd.sc-so.tsx` already pass `value: string[]` / `onChange` and `plants`. The component's public API (`{ value, onChange, plants, disabled }`) stays identical, so no route edits are needed.

### 3. Out of scope

- No backend / server-fn / zod schema changes.
- No changes to Reports screens.
- No changes to how `search_terms` is forwarded to SAP.

## Technical notes

- Input parsing: split on `/[,\s]+/`, filter empty, uppercase-preserving, dedupe while keeping order.
- F4 keyboard shortcut: `onKeyDown` on the input — `if (e.key === "F4") { e.preventDefault(); setOpen(true); }`.
- Popover positioning: reuse existing `align="start" side="bottom" sideOffset={6}` and z-index.
- Merge on Apply: union of typed codes and popup selection, preserving typed order first.
