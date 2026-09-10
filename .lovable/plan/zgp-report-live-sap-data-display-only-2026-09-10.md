# ZGP Report — live SAP data (display only)

Wire the ZGP Report screen's Execute button to the configured SAP report service so the table shows real RGP/NRGP records. Nothing else on the screen changes.

## Behaviour

- Execute sends the current filters (RGP/NRGP, Gate Pass Number, Plant, Material, Date, Vendor — each From/To) to the report service and fills the results table with whatever the service returns.
- Column headings come from the supplied field descriptions (Gate Pass Number, Gate Pass Date, Material, Description, Unit of measure, Requested Quantity, Net Value, Plant, Plant Name, Company Code, Vehicle No, Vendor, Vendor Name, Expected Return Date, User Remarks, Purpose, User, User Date, HOD User/Approval/Rejection/Date/Remarks/Time, Issued Qty, Store Approval, Justification, SCM Head/Date/User/Time, Actual Return Date, Store User, Store Date, PH Approval, PH Rejection, Receipt Button, Returned Quantity, Return Status, Return User/Date/Time, Plant Date, Plant Time, Remarks, Cancel Status, Canceled by/on/time). Any field the service returns that isn't in the list still shows, using its raw key.
- Dates display as DD-MM-YYYY; empty SAP placeholders (`0000-00-00`, `00:00:00`) show as a dash. Quantities and values stay right-aligned numbers.
- If the service is unreachable, disabled, or returns an error/no data, the exact message from SAP appears in the standard popup and the table stays empty.
- Reset clears filters and results as it does today. Search, page size, checkbox selection and the existing Cancel button keep working unchanged.

## Technical notes

- New `src/lib/mm/zgp-report.functions.ts`: authenticated `createServerFn` (`requireSupabaseAuth`) resolving the `ZGP_FETCH_REPORT` row from `sap_api_configs`, mirroring `src/lib/mm/zmc-report.functions.ts` for credentials, direct/proxy routing (`/sap/raw-invoke` with `raw: true`), `resolveSapUrl`, `sap_api_sync_log` entries and SAP message extraction. HTTP method comes from the config row (PUT).
- Payload sent verbatim, lowercase keys: `{ get_data: { type_from, type_to, number_from, number_to, material_from, material_to, date_from, date_to, plant_from, plant_to, vendor_from, vendor_to } }`.
- `src/routes/_authenticated/mm.zgp-report.tsx`: replace the static `rows`/hardcoded columns with `useServerFn` + `useMutation`, `buildDynamicColumns` driven by a `HEADER_LABELS` map plus text/numeric key lists, and `SapResponseDialog` for errors. Filter state, layout and permissions untouched.
- Verify with `bunx tsgo --noEmit -p tsconfig.json`.
