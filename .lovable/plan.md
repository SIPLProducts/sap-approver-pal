
## Objective
Bring the BMW Status Report selection screen into the **SD Dashboard** so users can pick a Selection Type + ranges + date range, press **Execute**, and see the KPI cards / charts / graphs recompute from that exact API response. No dummy data — everything is derived from `fetchBmwStatusReport` output.

## Scope (single file)
- `src/routes/_authenticated/sd.dashboard.tsx` — add a filter panel above the current dashboard body and switch data loading from auto-run `useQuery` to Execute-driven `useMutation`, then feed the resulting rows into the existing aggregation `useMemo` unchanged.

No other files change. Route, nav entry, server function, and BMW Status Report screen stay as-is.

## Filter panel (matches BMW Status Report)
Rendered in a `Card` at the top of the dashboard:

- **Sales Organization From / To** — `PlantSelect` (required, defaulted from active plants like today)
- **Customer From / To** — `CustomerSelect`, scoped to Sales Org From
- **Contract/Sales Created From / To** — date inputs (kept in state; used as a client-side row filter — see note below)
- **Selection Type** — `RadioGroup` for Customer / Contract / Sales Order (drives `mode` sent to the API; default `sales` so the widest schema is available for KPIs/charts)
- **Execute** button (primary) + **Reset** button
  - Execute disabled while pending or when Sales Org From/To empty
  - Shows spinner + "Loading…" while fetching
  - On success: toast "Loaded N records"; on error: toast the message

Dashboard body below the panel is unchanged in structure — only its data source swaps from `query.data` to the mutation's last successful response.

## Data flow
- Replace `useQuery({ queryFn: fetchBmwStatusReport, … })` with `useMutation` calling the same server fn (identical shape to BMW Status Report page).
- Store `rows`, `fetched_at`, and `mode` from the response in local state.
- `useMemo` aggregation (KPIs, top-10 customers, BP status donut, monthly trend, sales-org bars, release pipeline, PH throughput, top materials, division×channel) reads from these rows — no logic change.
- **Date range filter** (`contract_from` / `contract_to`) is passed to the server fn as today; additionally applied client-side against `CONTRACT_DATE || CONTRACT_CREATE_DATE || SALES_CREATE_DATE` before aggregation so the KPIs/charts always reflect the selected window even if SAP ignores the date range in the payload.
- Empty state (before first Execute): friendly card that says "Choose filters and click Execute to load the dashboard."
- Loading state: existing skeleton loaders reused.
- Refresh button in hero header re-runs the last Execute (same params); disabled until first Execute.

## Hero header updates
- Keep gradient header, plant-range chip, record count pill, last-refreshed time.
- Add small chips showing the active Selection Type and date range (when set) so the user can see what the numbers reflect.

## Out of scope
- No changes to `fetchBmwStatusReport`, BMW Status Report page, nav, routes, styles.css, or any other route.
- No new global tokens; keep using existing semantic tokens and `KpiTile` accents.
- No auto-refetch on filter change — Execute is the trigger, per the request.
