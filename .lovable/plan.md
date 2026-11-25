# Average Selling Rate: Change calls Average_Selling_Change_API

- Change (New Record unticked) sends one request to `Average_Selling_Change_API`. The request holds your signed-in SAP ID as `user_name`, plus a `modify` list with every ticked row.
- Each row sends MANDT, WERKS, KUNNR, MATERIAL, NAME1, UPDATED_BY, UPDATED_ON, APPROV_BY and STATUS exactly as SAP returned them, so nothing is hardcoded. AVG_RATE is the latest value you typed, sent as a number to match your example (12.00 is sent as 12).
- SAP's reply: TYPE "S" means success and TYPE "E" means error. The popup shows only SAP's MESSAGE, and the table reloads after a successful change. While SAP works, the button shows "Changing…".
- Delete still shows "SAP API not configured yet". Save does not change.

## Technical details
- `customer.functions.ts`: add `getAverageSellingChangeConfig`, which looks up `Average_Selling_Change_API`. It has the same shape as the Save config.
- `imw.average-selling-rate.tsx`: add `changing` state and a `change()` function that mirrors Financial Year Base Rate and reuses the existing `showSapResult`. Wire it to the Change button.
