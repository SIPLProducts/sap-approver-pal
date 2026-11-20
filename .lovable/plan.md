# Financial Year Base Rate — New Record, results table, Customer F4s, Save

Only `imw.financial-year-base-rate.tsx` (plus one small lookup in the existing SAP customer helpers file) changes. No other screen, API setting or logic changes.

## Selection area
- **New Record** checkbox right after the Plant field, same look and place as on Transportation (90%) Exception Billing.
- Execute calls SAP API **Finance_Save_API** with your signed-in user ID, the selected plants, and `check: "X"` when New Record is ticked (otherwise `""`).
- Reset also clears New Record and the table.

## Results table
- Columns: Plant (WERKS), Customer (KUNNR), Customer Name (NAME1), Material (MATERIAL), Financial Base Rate (FIN_RATE), Updated Person (UPDATED_BY), Updated Date (UPDATED_ON), Approver (APPROV_BY), Status (STATUS), Web User (shown when SAP sends a matching field). MANDT hidden.
- Handles any number of rows; a selection checkbox on each row, same as Transportation.
- **Customer** and **Customer Name** cells are F4 search pickers exactly like Transportation (90%) Exception Billing:
  - Customer F4 lists customers for that row's plant (`90%_Plant_Base_Cust_F4`).
  - Customer Name F4 lists names for that row's customer (`90%_CUST_Based_CUSTNAME`).
  - Choosing a value updates only that row.

## Save button
- Top-right of the table, same design and position as Transportation's Save.
- Sends the ticked rows (with edited Customer / Customer Name) and shows only SAP's message in the popup. The exact Save API name and payload need your confirmation; until then it uses the pattern below.

## Technical details
- Add `getFinanceSaveConfig` (case-insensitive lookup of `Finance_Save_API`, returns configId + sap_user_id), mirroring `getTransportSaveConfig`.
- Reuse existing `getTransportPlantCustConfig`, `getTransportCustBasedNameConfig`, `CustomerSelect`, `CloudscapeApprovalTable`, `runSapApi`, `swalSapResponse`.
- Save posts `{ save: { ...row, UPDATED_BY: userId } }` per ticked row to the configured Save API.
