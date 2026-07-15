# SD Dashboard — Selection Type radio (Customer / Contract / Sales)

Add the same three-way selector used in BMW Status Report to the SD Dashboard, and drive all KPIs and charts from the selected mode. Default = Customer.

## Scope
Only `src/routes/_authenticated/sd.dashboard.tsx`. No changes to server functions, business logic, aggregation math, or chart components.

## Changes

1. **Mode state**
   - Add `const [mode, setMode] = useState<"customer" | "contract" | "sales">("customer");`
   - Import `useState`, `RadioGroup`, `RadioGroupItem`, `Label`.

2. **Query wiring**
   - Include `mode` in `queryKey`: `["sd-dashboard-bmw", from, to, mode]`.
   - Pass `mode` (instead of the hardcoded `"sales"`) into `fetchFn({ data: { ..., mode } })`.
   - Result: the backend returns the customer / contract / sales scoped rowset, and every downstream memoised stat (KPIs, top customers, top materials, monthly trend, release pipeline, PH throughput, BP status pie) automatically recomputes from those rows. No aggregation logic changes.

3. **UI — Selection Type control**
   - In the hero header (right side, next to the Refresh button, wrapping cleanly on narrow widths), render a compact `RadioGroup` with three options: Customer, Contract, Sales Order — same labels and value keys (`customer` / `contract` / `sales`) as BMW Status Report.
   - Selecting an option updates `mode`; React Query refetches automatically due to the new key. Previous data stays visible via `placeholderData: (prev) => prev` (already set).

4. **Cosmetic**
   - Keep the "updated … rows" badge and Refresh button behaviour identical.
   - No changes to skeleton, empty state, or error state.

## Out of scope
- No changes to `fetchBmwStatusReport`, aggregation in the `stats` memo, chart definitions, colors, or KPI tiles.
- No new filters (customer range, contract-date range, etc.) — only the mode toggle.

## Verification
- Load `/sd/dashboard`; radio defaults to Customer, data loads.
- Switch to Contract, then Sales Order — spinner appears, KPIs/charts update, no console errors.
- Refresh button still works in each mode.
