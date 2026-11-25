# Average Selling Rate: Save calls Average_Selling_Save_API

- Save (New Record mode) sends one request to `Average_Selling_Save_API` with every ticked row in the `SAVE` list:
  `{ user_name: <signed-in SAP ID>, WERKS, KUNNR, NAME1, material: <Material>, AVG_RATE: <rate you typed> }`
- SAP's reply: TYPE "S" means success and TYPE "E" means error. The popup shows only SAP's MESSAGE text, one line per message.
- On full success, the table reloads with the same plants, as Financial Year Base Rate does. The button shows "Saving…" while it waits for SAP.
- Change and Delete stay as they are, still waiting for their APIs.

## Technical details
- `src/lib/sap/customer.functions.ts`: add `getAverageSellingSaveConfig`, which returns the configId of `Average_Selling_Save_API` and the userName. It has the same shape as `getFinanceCreateConfig`.
- `src/routes/_authenticated/imw.average-selling-rate.tsx`: copy `showSapResult` and `save()` from Financial Year Base Rate, with AVG_RATE in place of FIN_RATE. Import `swalSapResponse` and `extractSapMessage`, and add `saving` state. Change and Delete get their own placeholder handler.
