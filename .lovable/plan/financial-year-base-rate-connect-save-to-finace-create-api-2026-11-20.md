# Financial Year Base Rate — connect Save to Finace_create_API

Only Save on Financial Year Base Rate changes. Execute, Change, Delete, the columns and the pickers stay as they are.

## What Save will do
- It runs only when you click Save with at least one row ticked. The button stays greyed out until then, and while a save is in progress it reads "Saving…".
- It sends one request to **Finace_create_API** (the name as configured in SAP API Settings), with every ticked row in the `SAVE` list:
  - `user_name`: your signed-in SAP user ID
  - `WERKS`, `KUNNR`, `NAME1`, `FIN_RATE`: taken from the row, including any Customer or Customer Name you picked
  - `material`: taken from the row's MATERIAL value
- The popup shows only SAP's MESSAGE text. TYPE "S" counts as success and TYPE "E" as an error. One message line is shown per response entry.
- After a successful save, the table reloads automatically, like Transportation (90%) Exception Billing.
- If the API isn't switched on in SAP API Settings, the popup says "Finace_create_API is not configured or active."

## Technical details
- Add `getFinanceCreateConfig` to the existing customer SAP helpers file (case-insensitive lookup of `Finace_create_API`; returns configId + sap_user_id), mirroring `getTransportSaveConfig`.
- Replace the toast in `save()` with an async call:
  - `runSapApi({ configId, inputs: { SAVE: [...] } })`
  - Parse the response the same way as the Transportation `submit()` and show it with `swalSapResponse`.
  - If every result is OK, re-run `execute()`.
- Add a `saving` state. Values are sent as strings, and missing values as "".
