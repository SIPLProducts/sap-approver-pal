## Goal
On the Sales Order Approvals screen, when the user switches the Status radio (Pending / Accepted / Rejected), immediately clear the current table data and re-fetch from SAP for the newly selected status.

## Current behavior
`onStatusChange` (src/routes/_authenticated/sd.sales-order.tsx) only refetches when a previous fetch exists AND Plant is filled. Otherwise the old rows (from the previous status) stay on screen, which is confusing.

## Change
Edit `onStatusChange` in `src/routes/_authenticated/sd/sales-order.tsx`:

1. Always clear table state on status switch:
   - `setRows([])`
   - `setSelected(new Set())`
   - `setReasons(new Map())`
   - `setLastFetchedAt(null)`
2. Update URL search param to the new status (unchanged).
3. If `Plant` is filled, call `fetchFor(newStatus)` to load fresh data for Accepted / Rejected / Pending.
4. If `Plant` is empty, show a toast: "Enter Plant and click Execute" (no API call — Plant is mandatory).

No backend / server-function changes. No payload-shape changes. Only the status-switch handler in the page component.

## Acceptance
- Click Accepted → table clears instantly, spinner shows, rows for `R_ACCP=X` load.
- Click Rejected → same with `R_REJ=X`.
- Click Pending → same with `R_PEND=X`.
- Selection + reasons reset on every status switch.
- Without Plant, switching status clears the grid and prompts for Plant instead of silently keeping stale rows.