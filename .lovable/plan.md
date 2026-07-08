Hide the `release_code_1` and `approval_status` columns on the four SD approval screens. Reports screens remain unchanged.

## Changes

In each of these files, pass `exclude: ["release_code_1", "approval_status"]` to `buildDynamicColumns(rows, { ... })`:

- `src/routes/_authenticated/sd.contract.tsx`
- `src/routes/_authenticated/sd.sc-so.tsx`
- `src/routes/_authenticated/sd.sales-order.tsx`
- `src/routes/_authenticated/sd.price.tsx`

`buildDynamicColumns` in `src/lib/sd/dynamic-columns.tsx` already supports an `exclude` option, so no library change is needed.

## Out of scope

- Reports screens (`sd.contract-reports.tsx`, `sd.sc-so-reports.tsx`, `sd.sales-order-reports.tsx`, `sd.price-reports.tsx`) — untouched, columns still visible.
- No changes to server functions, payloads, or SAP calls.

## Verification

- Open each of the four approval screens → RELEASE_CODE1 and APPROVAL_STATUS columns are not shown.
- Open the corresponding Reports screens → both columns still shown.
- `tsgo` passes.
