## Objective

Add a modern, interactive **BMW Status Dashboard** that reuses the existing `fetchBmwStatusReport` server function (no dummy data). It shows KPIs, summary cards, and charts derived from the returned rows, and lets the user slice the data with filters that update the whole view dynamically.

## Location & navigation

- New route: `src/routes/_authenticated/sd.bmw-status-dashboard.tsx` (path `/sd/bmw-status-dashboard`).
- Add a "Dashboard" button on the existing `sd.bmw-status.tsx` header linking to the new page, and a "Back to Report" button on the dashboard linking back. No changes to report data logic.

## Selection screen (server-side filters, must run before dashboard renders)

Same required inputs as the report, since the SAP call requires them:
- Sales Organization From / To (`PlantSelect`) — required
- Customer From / To (`CustomerSelect`)
- Contract/Sales created From / To (date)
- Selection Type: Customer / Contract / Sales (`RadioGroup`) — controls which schema/columns SAP returns

An "Execute" button calls `fetchBmwStatusReport` via `useServerFn` + `useMutation`, exactly like the report page. Results stored in local state.

## Client-side interactive filters (slice loaded rows without re-hitting SAP)

Rendered above KPIs; each is populated from distinct values in the loaded rows:
- Sales Organization (multi-select)
- Customer (searchable select — Customer code + name)
- Contract Number (searchable select, only shown when Selection Type is Contract/Sales)
- Status (Active / Inactive / All) — derived from `BP_ACTIVE_INACTIVE` / `CON_ACTIVE_INACTIVE`
- "Clear filters" button

All KPIs, cards, and charts are computed with `useMemo` from the filtered row set so the dashboard updates instantly on any filter change.

## KPIs (top row — `KpiTile` component, already in project)

- Total Records (filtered rows count)
- Unique Customers (distinct `CUSTOMER`)
- Unique Contracts (distinct `CONTRACT_NO`, non-empty)
- Active Contracts (rows where `CON_ACTIVE_INACTIVE` = Active)
- Inactive Contracts (rows where `CON_ACTIVE_INACTIVE` = Inactive)
- Total Net Value (sum of `CONTRACT_NET_VALUE` / `NET_VALUE`)
- Total Tax (sum of `CONTRACT_TAX` / `TAX`)
- Grand Total (sum of `CONTRACT_TOTAL` / `TOTAL`)
- Sales Orders count + Sales Total (only when Selection Type = Sales; sums `SALES_NET_VALUE`/`SALES_TOTAL`)

Currency uses `toLocaleString("en-IN", …)` matching existing report formatting.

## Charts (recharts — already available via shadcn `chart` primitives)

1. **Contracts by Sales Organization** — bar chart, count of distinct contracts per `SALES_ORG`.
2. **Net Value by Sales Organization** — bar chart, sum of contract total per `SALES_ORG`.
3. **Active vs Inactive Contracts** — donut/pie chart using `CON_ACTIVE_INACTIVE`.
4. **Top 10 Customers by Total Value** — horizontal bar chart, `CUSTOMER_NAME` × sum of `CONTRACT_TOTAL`.
5. **Contract Creation Trend** — line chart, contracts grouped by month (`CONTRACT_DATE` / `CONTRACT_CREATE_DATE`).
6. **Top 10 Contracts by Value** — table/list with contract no, customer, total.

Each chart lives in a `Card` and re-renders from the filtered dataset.

## Empty & loading states

- Before Execute: show a subtle placeholder Card explaining "Select filters and click Execute to load dashboard data from SAP." — no dummy numbers.
- During fetch: skeleton shimmer in KPI tiles and charts.
- After fetch with zero rows: "No records match the current filters."
- SAP errors bubble via `toast.error` (same as report).

## Styling & responsiveness

- Use existing `PageHeader`, `KpiTile`, `Card`, `Button`, shadcn `chart` primitives.
- Semantic tokens only (no hard-coded colors); charts use `--primary`, `--success`, `--destructive`, `--info`, `--warning` tokens.
- Grid: KPIs `grid-cols-2 md:grid-cols-3 xl:grid-cols-4`; charts `grid-cols-1 lg:grid-cols-2`.
- Follow the responsive header pattern (`grid-cols-[minmax(0,1fr)_auto]` + `min-w-0` / `shrink-0`).

## Technical details

- New file only; **no** changes to `bmw-status-report.functions.ts`.
- Small helpers colocated in the route file:
  - `pickValue(row, key, aliases[])` — reuse alias logic (BP_SERVICE_VALID_FROM vs BP_SRV_VALID_FROM, CONTRACT_NET_VALUE vs NET_VALUE, etc.).
  - `toNumber(v)` for safe numeric aggregation.
  - `parseSapDate(v)` for month bucketing (handles `YYYY-MM-DD` and `YYYYMMDD`).
  - `normalizeStatus(v)` mapping SAP flags to Active / Inactive.
- Route registration updates `src/routeTree.gen.ts` automatically via the TanStack Router Vite plugin at build time.
- Head metadata: title "BMW Status Dashboard", description summarizing the analytics view.

## Out of scope

- No changes to the existing report page's data flow, columns, or filters (only a "Dashboard" link button added to its header).
- No new server functions, DB migrations, or SAP config changes.
- No persisted user preferences for filters (session-only state).
