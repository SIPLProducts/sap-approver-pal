# Vehicle Master – connect Execute to VM_GET_API

## What changes
- Execute on Vehicle Master calls `VM_GET_API` with your SAP user ID, the selected plant(s), and `check` = "X" when New Record is ticked, otherwise " ".
- Results show in a table with columns: Plant, Vehicle Number, Material Qty - RTO-CAPACITY (in Tons), Material Net Weight * 90%, Vehicle Tonnage, Vehicle Type, Transport Name. MANDT stays in the row data but is hidden.
- Every row gets a selection checkbox.
- New Record ticked: Save button at top-right of the table. Unticked: Change and Delete buttons. Placement and look match Distance Master.
- Save, Change and Delete show "SAP API not configured yet" until their API details are sent.
- Reset clears the table and selection too.

## Technical details
- Add `getVehicleMasterGetConfig` to `src/lib/sap/customer.functions.ts`, copied from `getDistanceMasterGetConfig` but looking up `VM_GET_API`.
- In `imw.vehicle-master.tsx`, reuse Distance Master's `fetchMutation` / `runSapApi` / `extractRows` / `executedCheck` / `selectedRowKeys` / `CloudscapeApprovalTable` + `headerExtras` pattern.
- No other screens or APIs touched.
