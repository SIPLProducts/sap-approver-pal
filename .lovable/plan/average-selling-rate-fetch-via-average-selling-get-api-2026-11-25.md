# Average Selling Rate: fetch via Average_Selling_Get_API

## What changes
- Execute on Average Selling Rate calls `Average_Selling_Get_API` with:
  `{ get_data: { user_name: <signed-in SAP ID>, plant: [{ plant }...], check: "X" if New Record ticked, otherwise " " } }` (same rule as Financial Year Base Rate).
- Results table (below the input card) with columns: Plant (WERKS), Customer (KUNNR), Customer Name (NAME1), Material (MATERIAL), Average Selling Rate (AVG_RATE), Updated Person (UPDATED_BY), Updated Date (UPDATED_ON), Approver (APPROV_BY), Status (STATUS).
- All returned rows shown, with the same table component and pagination as Financial Year Base Rate. Empty values show "—"; 0 shows as "0" (not blank).
- Errors/empty results use the same toasts as Financial Year Base Rate. Reset also clears the table.
- Read-only display for now (no Save/Change/Delete, no editing) until those APIs are provided.

## Technical details
- `src/lib/sap/customer.functions.ts`: add `getAverageSellingGetConfig` (same shape as `getFinanceSaveConfig`, name `Average_Selling_Get_API`, returns configId + userName).
- `src/routes/_authenticated/imw.average-selling-rate.tsx`: add config query, `fetchMutation` via `runSapApi`, `extractRows`, rows state and `CloudscapeTable` columns, mirroring the Financial Year Base Rate file. Nothing else touched.
