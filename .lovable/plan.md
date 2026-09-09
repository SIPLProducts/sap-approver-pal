# Price Master Update — flatten Update payload

## Change

In `src/lib/imw/price-master.functions.ts`, change the `updatePriceMaster` payload sent to SAP from the nested wrapper:

```json
{ "update": { "data": { "update": { "data": <row> } } } }
```

to the flat structure:

```json
{ "update": { "data": <row> } }
```

`<row>` is the existing `payloadData` built by `buildUpdateData()`, which already contains the full field list (`WERKS`, `KUNNR`, `ZCUST_NAME`, …, `PRICE_REMARKS`) with numeric/string coercion.

## What stays the same

- `buildUpdateData()` field list and numeric coercion.
- Config lookup (`IMW_PMU_EDIT_API` / `IWM_PMU_EDIT_API` fallback).
- Credentials, proxy/direct routing, headers, Basic auth, `x-shared-secret`, `sap_api_sync_log` logging.
- One API call per selected row.
- Response parsing: `STATUS` / `TYPE` inspection, `SapResponseDialog` rendering, success/error handling.
- The Price Master Update screen (`src/routes/_authenticated/imw.price-master.tsx`) — no UI changes.

## Verification

Run `bunx tsgo --noEmit -p tsconfig.json` after the edit.
