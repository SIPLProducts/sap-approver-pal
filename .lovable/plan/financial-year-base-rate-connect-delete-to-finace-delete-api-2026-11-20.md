# Financial Year Base Rate — connect Delete to Finace_Delete_API

Only Delete on Financial Year Base Rate changes. Execute, Save, Change, the columns and the pickers stay as they are.

## What Delete will do
- It runs only when you click Delete with at least one row ticked. The button stays greyed out until then, and while the delete is being sent it reads "Deleting…".
- It sends one request to **Finace_Delete_API**, shaped like your example:
  - `user_name`: your signed-in SAP user ID
  - `delete`: one entry for each ticked row, with MANDT, WERKS, KUNNR, MATERIAL, NAME1, FIN_RATE, UPDATED_BY, UPDATED_ON, APPROV_BY and STATUS taken from that row
- The popup shows only SAP's MESSAGE text. TYPE "S" counts as success and TYPE "E" as an error.
- After a successful delete, the table reloads, the same as after Save and Change.
- If the API isn't switched on in SAP API Settings, the popup says "Finace_Delete_API is not configured or active."
- No extra "are you sure" step, matching how Save and Change work on this screen.

## Technical details
- Add `getFinanceDeleteConfig` to the customer SAP helpers file (case-insensitive lookup of `Finace_Delete_API`; returns configId + sap_user_id).
- Replace the toast in `remove()` with the same flow as `change()`. It reuses `showSapResult(response, "Deleted")` and re-runs `execute()` on success.
- Add a `deleting` state.
