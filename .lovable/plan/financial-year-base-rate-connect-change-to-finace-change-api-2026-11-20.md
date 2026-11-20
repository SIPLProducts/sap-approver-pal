# Financial Year Base Rate — connect Change to Finace_Change_API

Only Change on Financial Year Base Rate changes, plus making Financial Base Rate editable so an updated rate can be sent. Execute, Save, Delete, the pickers and the other columns stay as they are.

## Editing the rate
- Financial Base Rate becomes a small input box in each row, but only when the table was loaded without New Record. You can type the new rate there before clicking Change.
- In New Record mode it stays plain text, as it is now.

## What Change will do
- It runs only when you click Change with at least one row ticked. The button stays greyed out until then, and while the change is being sent it reads "Changing…".
- It sends one request to **Finace_Change_API**, in the shape of your example:
  - `user_name`: your signed-in SAP user ID
  - `modify`: one entry for each ticked row, with MANDT, WERKS, MATERIAL, NAME1, FIN_RATE (the rate you typed), UPDATED_BY, UPDATED_ON, APPROV_BY and STATUS taken from that row
- The popup shows only SAP's MESSAGE text, for example "Not Authorised user for Plant". TYPE "S" counts as success and TYPE "E" as an error.
- After a successful change, the table reloads, the same as after Save.
- If the API isn't switched on in SAP API Settings, the popup says "Finace_Change_API is not configured or active."

## Technical details
- Add `getFinanceChangeConfig` to the customer SAP helpers file (case-insensitive lookup of `Finace_Change_API`; returns configId + sap_user_id).
- In the columns `useMemo`, render FIN_RATE as an `Input` that calls `updateRow` when `executedCheck !== "X"`. Add `executedCheck` to the dependency list.
- Move the response parsing and popup from `save()` into a shared helper, and use it for both Save and Change. Save keeps the same payload and behaviour.
- Add a `changing` state. Values are sent as strings, and missing values as "".
- KUNNR isn't sent, because your example payload doesn't include it.
