# SD Dashboard: default SAP payload values

## Goal

Make the SD Dashboard's initial SAP call use the exact default payload values the user specified, without altering any other existing logic or UI behavior.

## Current state

`src/routes/_authenticated/sd.dashboard.tsx` calls `fetchBmwStatusReport` with:

- `sales_org_from` / `sales_org_to`: derived from the first and last active plants
- `customer_from` / `customer_to`: empty strings
- `contract_from` / `contract_to`: empty strings
- `mode`: `"sales"` (which sends `R_SALES: "X"`)

## Required defaults

```json
{
  "SALES_ORG_FROM": "3801",
  "SALES_ORG_TO": "3801",
  "CUSTOMER_FROM": "",
  "CUSTOMER_TO": "",
  "CONTRACT_FROM": "2026-03-01",
  "CONTRACT_TO": "2026-03-25",
  "R_CUS": "X",
  "R_CONT": "",
  "R_SALES": ""
}
```

This maps to `fetchBmwStatusReport` input values:

- `sales_org_from`: `"3801"`
- `sales_org_to`: `"3801"`
- `customer_from`: `""`
- `customer_to`: `""`
- `contract_from`: `"2026-03-01"`
- `contract_to`: `"2026-03-25"`
- `mode`: `"customer"` (so the server function sets `R_CUS: "X"` and `R_SALES`/`R_CONT` empty)

## Changes

### `src/routes/_authenticated/sd.dashboard.tsx`

1. Replace the query key and `enabled` dependency so the dashboard always fetches with the fixed defaults rather than deriving sales org from active plants.
2. Update the `queryFn` payload to send the default values above.
3. Keep the Date Range filter, KPIs, charts, table, skeletons, and refresh behavior exactly as they are.

## Out of scope

- No changes to `fetchBmwStatusReport` or the server function payload mapping.
- No changes to the Date Range filter, KPI calculations, chart rendering, or table layout.
- No changes to other screens or the shared layout.
