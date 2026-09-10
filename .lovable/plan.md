# ZMC Report: Plain-Text Date Pickers

## Goal

Replace the calendar popover date pickers on the ZMC Report screen with simple, user-friendly DD-MM-YYYY text inputs. All existing functionality, filters, state, reset/execute behavior, and business logic remain unchanged.

## What changes

1. **Replace the `DateField` component** in `src/routes/_authenticated/mm.zmc-report.tsx`.
   - Remove the `Calendar`/`Popover` imports and the `calendarStyles` object.
   - Render a plain `Input` for each date field with placeholder `DD-MM-YYYY`.
   - Keep the existing `value: Date | undefined` prop and `onChange` contract so the parent state (`dateFrom`, `dateTo`) is unaffected.

2. **Add lightweight date parsing/validation**.
   - Accept user input in `DD-MM-YYYY` format.
   - On change/blur, parse the string into a `Date` only when it matches `dd-MM-yyyy` exactly.
   - If the input is empty, set the value to `undefined`.
   - If the input is invalid, show a subtle error state on the field (e.g., red border) but do not block other filters or Execute/Reset.

3. **Preserve layout and styling**.
   - Keep the From/To grouping, separator, responsive grid, and field label placement.
   - Match the existing input height, font, and shadow-none styling used by the other From/To inputs.
   - Remove the calendar icon since the field is no longer a date picker.

4. **No changes outside this file**.
   - Do not touch route config, sidebar, permissions, SAP wiring, table columns, Execute/Reset logic, or any other MM screen.

## File touched

- `src/routes/_authenticated/mm.zmc-report.tsx`

## Verification

- Run `bunx tsgo --noEmit -p tsconfig.json`.
- Open the ZMC Report screen and confirm:
  - Both date fields render as plain inputs with the `DD-MM-YYYY` placeholder.
  - Typing a valid date updates the field and the underlying state.
  - Reset clears both date fields.
  - Execute still reveals the empty results card as before.
  - Other filters (Plant, Document Number, Movement Type) are unaffected.
