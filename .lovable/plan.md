# SD Dashboard: fixed 6-up KPI row + Date Range filter

## 1. KPI cards always 6 per row

The KPI section currently reflows (2 columns on mobile, 3 on large, 6 on extra-large). Change it to a fixed 6-column grid at every breakpoint, so all six tiles stay on one line regardless of screen width. On narrow screens the row scrolls horizontally instead of wrapping, so cards keep a readable minimum width rather than being squeezed to nothing. Tighter gap and slightly smaller tile padding at small widths keep the row compact.

The loading skeleton's KPI row gets the same fixed 6-up treatment so the layout does not jump when data arrives.

## 2. Date Range filter

A Date Range control is added to the dashboard header actions area, next to Refresh:

- Two date pickers, From and To (calendar popovers), plus a Clear action.
- Quick presets for common ranges: Last 30 days, Last 90 days, This year.
- Empty range = current behaviour, all rows included.

The filter applies to the report rows already returned by SAP, so no change to the existing SAP request or server function. Rows are matched on their document dates (contract date / contract create date, and sales create date); a row is kept when any of its dates falls inside the selected range. Rows with no parseable date are kept, so nothing silently disappears.

Every KPI, chart and table on the page is derived from the same row set, so all of them respond to the range automatically. A small badge in the header shows the active range and the filtered row count.

## Technical notes

- File touched: `src/routes/_authenticated/sd.dashboard.tsx` only.
- KPI grid: replace `grid-cols-2 lg:grid-cols-3 xl:grid-cols-6` with a fixed `grid-cols-6` inside an `overflow-x-auto` wrapper with a min-width so tiles do not collapse; same for `DashboardSkeleton`.
- New local state `dateFrom` / `dateTo` (`Date | undefined`), rendered with the shadcn Calendar in a Popover (`pointer-events-auto` on the calendar).
- New `filteredRows` memo between `rows` and the `stats` memo: parses SAP date strings (`YYYY-MM-DD` and `YYYYMMDD`) from `CONTRACT_DATE`, `CONTRACT_CREATE_DATE`, `SALES_CREATE_DATE`; the existing `stats` memo switches its input from `rows` to `filteredRows`.
- No changes to `fetchBmwStatusReport`, the query key, caching behaviour, or any existing KPI/chart computation logic.
