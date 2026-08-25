# SD Dashboard: server-side date + plant filters, polished date picker

## What changes

1. **Date range is sent to SAP**, not just used to filter rows locally.
   When the user picks From/To, those dates go into the report payload as
   `CONTRACT_FROM` / `CONTRACT_TO` and the dashboard re-fetches.

2. **Top-bar plant selection is sent to SAP.**
   The plants selected in the header drive `SALES_ORG_FROM` / `SALES_ORG_TO`
   (lowest and highest selected code). Changing the selection refetches.

3. **Defaults stay exactly as today** when the user hasn't touched anything:
   `SALES_ORG_FROM/TO = 3801`, `CUSTOMER_FROM/TO = ""`,
   `CONTRACT_FROM = 2026-03-01`, `CONTRACT_TO = 2026-03-25`, `R_CUS = X`.

4. **Date Range calendar redesigned** to match the reference: a single clean
   month calendar with a back/forward header, Su–Sa column labels, muted
   out-of-month days, a highlighted selected day, and a bottom action row with
   **Last 7 days**, **Last 30 days**, and **Clear**.

Everything else — KPIs, charts, table, skeletons, refresh button, styling —
stays as is.

## Technical notes

File touched: `src/routes/_authenticated/sd.dashboard.tsx` only. No change to
`fetchBmwStatusReport` or the server payload mapping.

- Read `activePlants` from `useActiveContext()`. Derive
  `salesOrgFrom = sorted[0] ?? "3801"`, `salesOrgTo = sorted.at(-1) ?? "3801"`.
- Move `dateFrom` / `dateTo` state above the query. Format selected dates as
  `yyyy-MM-dd`; when unset, fall back to the existing literal defaults.
- Query key becomes
  `["sd-dashboard-bmw", salesOrgFrom, salesOrgTo, contractFrom, contractTo]`
  so filter changes trigger a fetch; `staleTime`, `gcTime`, and
  `placeholderData` behaviour unchanged.
- The existing client-side `filteredRows` memo is kept as-is (harmless
  second pass) so KPI/chart/table derivation is untouched.
- `DateRangeFilter`: keep the two-trigger From/To layout, restyle the popover
  footer to `Last 7 days · Last 30 days · Clear` (Clear in destructive/red
  text), and keep `pointer-events-auto` on the calendar.

## Open assumption

Selected plant codes are used directly as sales-org values. If your plants and
sales orgs differ, tell me the mapping and I'll adjust before building.
