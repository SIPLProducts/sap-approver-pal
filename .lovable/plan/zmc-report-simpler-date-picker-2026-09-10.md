# ZMC Report: Simpler Date Picker

## Goal

Keep the date picker on the ZMC Report screen but make it compact, clean, and easy to use. All existing functionality, filters, state, reset/execute behavior, and business logic remain unchanged.

## What changes

1. **Compact the calendar popover** in `src/routes/_authenticated/mm.zmc-report.tsx`.
   - Reduce the calendar cell size from `2rem` to a smaller value (e.g., `1.75rem`) so the popover is less bulky.
   - Tighten the calendar wrapper padding from `p-3` to `p-2`.
   - Keep the centered month caption, rounded navigation buttons, centered weekday row, muted outside days, and rounded selected-day styling already in place.

2. **Simplify the date trigger button**.
   - Keep the `Button` trigger but make it less prominent: remove the calendar icon or keep only a small one, and ensure the text remains left-aligned and readable.
   - Keep the `DD-MM-YYYY` display format and placeholder text.

3. **Preserve layout and behavior**.
   - Leave the From/To grouping, separator, responsive grid, and field label placement exactly as today.
   - Keep `dateFrom`/`dateTo` state, reset/execute, and all filter logic untouched.

4. **No changes outside this file**.
   - Do not touch route config, sidebar, permissions, SAP wiring, table columns, or any other MM screen.

## File touched

- `src/routes/_authenticated/mm.zmc-report.tsx`

## Verification

- Run `bunx tsgo --noEmit -p tsconfig.json`.
- Open the ZMC Report screen and confirm:
  - The From/To date pickers still open a calendar popover.
  - The calendar is visibly smaller and cleaner.
  - Date selection, Reset, and Execute behave exactly as before.
  - Other filters are unaffected.
