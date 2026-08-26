# SD Dashboard: Redesign Date Range Calendar

## What changes

Redesign the date picker popover in the SD Dashboard header so the monthly calendar matches the reference image. The calendar will show:

- A single clean month view with centered "Month Year" header.
- Simple rounded previous/next navigation arrows aligned to the header row.
- Weekday row as `Su Mo Tu We Th Fr Sa` with consistent spacing and alignment.
- Muted, unselectable out-of-month days.
- A rounded (not range-style) highlight for the selected day.
- Slightly more generous internal padding for readability.
- The existing preset footer (`Last 7 days`, `Last 30 days`, `Clear`) remains unchanged.

All existing date-range functionality and API logic is preserved: `dateFrom`/`dateTo` state, the default March 2026 fallback, the SAP payload (`CONTRACT_FROM` / `CONTRACT_TO`), plant integration, and query refetch behavior stay exactly as today.

## Technical notes

- File touched: `src/routes/_authenticated/sd.dashboard.tsx` only.
- The `DateRangeFilter` component keeps its two-trigger From/To layout and its `preset()` / `onClear` callbacks.
- The `Calendar` component inside each popover is restyled by passing a custom `classNames` object to the existing `react-day-picker` based shadcn `Calendar`:
  - `month_caption`: centered, medium weight.
  - `nav`: simple absolute left/right with square rounded ghost buttons.
  - `weekday`: centered, muted, small.
  - `day_button`: centered, rounded-md.
  - `selected`: solid primary background with white text and rounded-md.
  - `outside`: low-opacity muted text.
  - `today`: subtle ring or border instead of the default accent fill.
- Hardcoded color values are avoided; styling uses the project's existing semantic tokens (`--primary`, `--primary-foreground`, `--muted-foreground`, `--border`, etc.) via Tailwind utilities.
- `pointer-events-auto` remains on the calendar so it stays interactive inside the popover.
- No change to the dashboard query key, payload, KPIs, charts, tables, or skeleton.
