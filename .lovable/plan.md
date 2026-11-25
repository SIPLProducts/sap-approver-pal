# Average Selling Rate: Delete calls Average_Selling_Delete_API

- Delete (New Record unticked) sends one request to `Average_Selling_Delete_API`. It carries your signed-in SAP ID as `user_name` and a `delete` list of every ticked row.
- Each row sends MANDT, WERKS, KUNNR, MATERIAL, NAME1, AVG_RATE (as a number, the same as Change), UPDATED_BY, UPDATED_ON, APPROV_BY and STATUS, all taken from the row as it is.
- SAP's reply: TYPE "S" means success and TYPE "E" means error. The popup shows only SAP's MESSAGE text, and the table reloads after a successful delete. The button reads "Deleting…" while it runs.
- There is no extra confirmation popup, the same as Financial Year Base Rate.

## Technical details
- `customer.functions.ts`: add `getAverageSellingDeleteConfig`, which looks up `Average_Selling_Delete_API`. It has the same shape as the Change config.
- `imw.average-selling-rate.tsx`: add `deleting` state and a `remove()` function that mirrors `change()` with a `delete` key. Wire it to the Delete button, and drop the now-unused placeholder handler.
