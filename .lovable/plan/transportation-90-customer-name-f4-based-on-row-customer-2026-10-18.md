# Transportation (90%) — Customer Name F4 based on row Customer

Wire the Customer Name dropdown in each results-table row to `90%_CUST_Based_CUSTNAME`, using that row's Customer value.

## Behavior
- Opening a row's Customer Name dropdown calls `90%_CUST_Based_CUSTNAME` with `{ "CUST_NAM": "<row's Customer>" }`.
- Lists the returned `NAME1` values (same F4 design: search, paging, loading/error states, de-duplication).
- Picking a value fills that row's Customer Name; it is then sent by Save/Change as today.
- When the row's Customer changes, the dropdown re-queries with the new value.

## Implementation
- `src/lib/sap/customer.functions.ts`: add `getTransportCustBasedNameConfig` (same pattern as the others) looking up the active config named `90%_CUST_Based_CUSTNAME` case-insensitively.
- `src/routes/_authenticated/imw.transportation-exception-billing.tsx`: add a query for that config; the NAME1 column's `CustomerSelect` uses its configId and `inputs={{ CUST_NAM: String(row.KUNNR ?? "") }}`, codeField/textField `NAME1`. Add the new configId (and plant-cust configId) to the columns memo deps.

## Unchanged
Filter card, Execute payload, Customer column F4, Save/Change/Delete logic, other screens.

## Verification
Typecheck; preview check that the column renders.
