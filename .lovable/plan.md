# Distance Master: fetch via DM_GET_API + row selection and buttons

## What you'll see
- **Execute** calls DM_GET_API with your SAP user ID and the plants you picked. `check` is "X" when New Record is ticked, otherwise " ".
- Results show in a table below the selection area with columns **Customer, Plant, Distance** — all records SAP returns. Values like 82.0 display as 82.0, empty values as "—", 0 as "0". MANDT is kept in each row (for later Change/Delete) but not shown.
- Every row has a checkbox at the start.
- **New Record ticked:** Save button at the top right of the table; Change and Delete hidden.
- **New Record unticked:** Change and Delete at the top right; Save hidden.
- Buttons are disabled until a row is selected, and act only on the ticked rows. Until you send their API details, they show "SAP API not configured yet".
- Execute and Reset clear the selection. Same table, checkbox and button styling as Financial Year Base Rate.

## Technical details
- `src/lib/sap/customer.functions.ts`: add `getDistanceMasterGetConfig` (copy of `getAverageSellingGetConfig`, looks up `DM_GET_API`, returns config id + profile `sap_user_id`).
- `src/routes/_authenticated/imw.distance-master.tsx`: add `fetchMutation` via `runSapApi`, `extractRows`, `rows`, `executedCheck`, `selectedRowKeys` state, and `CloudscapeApprovalTable` with `showSelect` and `headerExtras`, mirroring `imw.average-selling-rate.tsx`. Mode follows the New Record value used at Execute.
- No other screens or APIs change.
