# SD Dashboard: filter bar (Plant, From/To Date, Selection Type)

## What changes

A single compact filter bar sits directly under the page header, styled like the reference: a "FILTERS" label on the left, then the controls in one row, wrapping on small screens.

Controls:

- **Plant** — the same plant picker used on BMW Status Report / other screens, limited to the plants assigned to the logged-in user. Defaults to the plant already derived from the top-bar selection, so the dashboard behaves exactly as today until changed.
- **From Date** and **To Date** — calendar pickers (the two pickers that exist today next to Refresh move here).
- **Selection Type** — the same three options as BMW Status Report: Customer, Contract, Sales. **Customer is selected by default.**
- **Apply** and **Clear** actions. Apply triggers the SAP call with the chosen values; Clear resets to defaults.

The **Date Range control beside the Refresh button is removed** — Refresh stays on its own.

## How filters reach the data

- Plant is sent as the sales-org range in the existing payload, and Selection Type is sent as the existing `mode` value, so the SAP call is made with the user's selections and the dashboard re-renders from that response.
- The BMW report API has no date parameters, so From/To Date continue to narrow the returned rows on the document dates (contract date, contract create date, sales create date) exactly as the current date filter does. If SAP later exposes date inputs, they can be added to the same payload without touching the UI.

Every KPI, chart and table already derives from the same row set, so all of them follow the filters automatically. A badge in the header keeps showing the row count and active date range.

## Notes

- Only `src/routes/_authenticated/sd.dashboard.tsx` is edited: new local filter state (plant, from, to, selection type) plus an "applied" snapshot that feeds the query key and payload; the existing `DateRangeFilter` pickers are reused inside the new bar; `PlantSelect` (user-plant source) and a `RadioGroup` mirror the BMW screen.
- Default selection type changes from `sales` to `customer`, per the request.
- No changes to `fetchBmwStatusReport`, KPI/chart computation, styling tokens, or any other screen.
