# SD Dashboard: Compact Date Range Calendar

## What changes

Reduce the overall height and width of the Date Range calendar popover in the SD Dashboard filter section so it fits more neatly without altering the existing design, date range behaviour, or API logic.

## How

1. Tighten the `Calendar` wrapper padding from `p-4` to `p-2.5` inside `DateRangeFilter`.
2. Reduce the CSS cell-size variable from `[--cell-size:2.5rem]` to `[--cell-size:2rem]` so day cells, navigation buttons, and the month caption row become smaller.
3. Slightly compact the preset footer: reduce vertical padding from `p-2` to `p-1.5` and preset button height from `h-7` to `h-6` with corresponding text size `text-xs`.
4. Leave all calendar `classNames`, selection logic, preset callbacks (`Last 7 days`, `Last 30 days`, `Clear`), date state, and the SAP payload construction untouched.

## File touched

- `src/routes/_authenticated/sd.dashboard.tsx` only (`DateRangeFilter` component).

## Verification

- Open the SD Dashboard, expand the From/To date pickers, and confirm the calendar is visibly smaller while still readable.
- Confirm date selection, presets, Clear, and the subsequent API payload still work as before.
