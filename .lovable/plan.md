# ZMC Report — connect to SAP (display only)

Wire the existing ZMC Report screen to the configured `ZMC_FETCH_REPORT` service so Execute fetches real records. Display only — no approve, reject, save or edit actions.

## Behaviour

- **Execute** sends the current filter values to the report service and fills the results table.
- Filters map one-to-one to the service inputs: Plant From/To, Date From/To, Document Number From/To, Movement Type From/To. Empty fields are sent as empty values, exactly as the service expects.
- Dates are sent in the service's `YYYY-MM-DD` form while the screen keeps showing DD-MM-YYYY.
- **Reset** clears the filters and the results, as today.
- While loading, the Execute button shows a busy state; the results area shows a loading state.
- If the service cannot be reached or returns a message instead of records, the exact message from the response is shown in the standard response popup and no rows are added.
- No records for the chosen filters shows the normal empty-results message.

## Results table

Columns are built from the returned records — nothing hardcoded. Any field the service returns appears, with readable headers taken from the documented field list:

Document Number, Plant, Material Number, Material Description, Requested Quantity, Unit, Created On, Storage Location, Order Number, HOD Approval, HOD Rejection, HOD Approval Date, GL Account, Movement Type, Cost Center, Approved Quantity, Issued Quantity, Reservation Number, Material Document, Material Document Item, Reversal No, Posted By, Posted On, Net Value, Cancel Status, Canceled By, Canceled On, Canceled Time.

Dates display as DD-MM-YYYY, quantities and values are right-aligned, and placeholder dates such as `0000-00-00` show as a dash. Sticky header, horizontal scroll on narrow screens and the page-size control stay as they are.

## Not changed

No changes to Material Reservation, ZGP Report or any other screen; no changes to existing APIs, validations, filters, pagination, permissions or SAP configuration.

## Technical notes

- New `src/lib/mm/zmc-report.functions.ts`: `fetchZmcReport` server function with `requireSupabaseAuth`, resolving the `ZMC_FETCH_REPORT` row from `sap_api_configs`, following the same direct/proxy routing, basic-auth, extra-headers, sync-logging and message-extraction conventions as `src/lib/imw/price-master-approvals.functions.ts`.
- Payload sent verbatim: `{ get_data: { PLANT_FROM, PLANT_TO, DATE_FROM, DATE_TO, DOC_FROM, DOC_TO, TYPE_FROM, TYPE_TO } }`; response array (or `DATA`-wrapped array) normalised to rows via the existing `pickRows`-style helper.
- `src/routes/_authenticated/mm.zmc-report.tsx`: replace the static column list with `buildDynamicColumns` from `src/lib/sd/dynamic-columns.tsx`, passing `headerLabels` for the documented keys, `textKeys` for identifier-like fields (`DOCUMENT_NO`, `PLANT`, `MATERIAL`, `MOVEMENT_TYPE`, `COST_CENTER`, `GL_ACCOUNT`, `STORAGE_LOCATION`, `ORDER_NUMBER`, `SAP_MATERIAL_DOCUMENT`, `REVERSAL_NO`) and `numericKeys` for quantity/value fields; call the server fn through `useServerFn` inside a `useMutation`, and surface failures with `SapResponseDialog`.
- Verification: `bunx tsgo --noEmit -p tsconfig.json`.
