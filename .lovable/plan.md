# ZMC Report — Cancel selected records

Wire the existing Cancel button on the ZMC Report results to the SAP cancel service. Nothing else on the screen changes.

## Behaviour

- Select one or more records, then click Cancel.
- A confirmation asks before cancelling (matching the existing Reject/UnRelease confirmation style).
- Each selected record is sent to SAP one at a time, using the exact filter values currently applied plus that record's own fields, sent back exactly as SAP returned them.
- The result popup lists one line per record with the exact message SAP returns, marked success or error, using the same response popup as the other MM screens.
- Records that cancelled successfully are removed from the selection and the report is refreshed with the same filters so the updated cancel status shows.
- If nothing is selected, the button stays disabled as it does today.

## Not changed

Filters, date pickers, Execute, Reset, column building, search, pagination, page size, permissions, the report fetch service, other MM/SD/IWM screens, and all other APIs stay exactly as they are.

## Technical notes

- New `cancelZmcRecords` in `src/lib/mm/zmc-report.functions.ts`, mirroring `fetchZmcReport`: resolve the `ZMC_Cancel_Report` config from `sap_api_configs` by name, honour `is_active`, `http_method` (POST), `auth_type`, credentials, extra headers, and direct-vs-proxy routing via `sap_global_settings`/`sap_global_secrets` with `raw: true`; log to `sap_api_sync_log`.
- Input: the eight `input_data` filter values (same shape as the fetch inputs) plus an array of raw row objects. One request per row with body `{ input_data: { PLANT_FROM, PLANT_TO, DATE_FROM, DATE_TO, DOC_FROM, DOC_TO, TYPE_FROM, TYPE_TO }, cancel: <row> }`. Row keys are passed through dynamically — no hardcoded field list.
- Row values are taken from the untouched SAP response, so the SAP placeholder normalisation used for display must not leak into the payload: keep the raw rows alongside the normalised display rows in `mm.zmc-report.tsx`.
- Reuse `extractSapMsg`; treat `TYPE` `E`/`A` or `STATUS` false as failure, `S` as success. Return `{ ref, message, ok }` per row for `SapResponseDialog`.
- `mm.zmc-report.tsx`: keep the last executed filters in state, add a mutation for the cancel fn, wire the existing `headerExtras` Cancel button (loading state while running), show results in `SapResponseDialog`, then re-run the report.
- Verification: `bunx tsgo --noEmit -p tsconfig.json`.
