# Distance Master: Plant first, Customer F4, editable Distance

## What changes (Distance Master screen only)
1. **Column order**: Plant, Customer, Distance.
2. **Customer F4 in New Record mode**: when Execute ran with New Record ticked, the Customer cell becomes the same pick-from-list dropdown used on Financial Year Base Rate / Average Selling Rate (search, select, fills the row's Customer). It lists customers for that row's Plant. Without New Record, Customer stays plain read-only text.
3. **Distance editable in both modes**: a text box in each row; typed values are kept on the row so Save/Change/Delete use them later.
4. Row checkboxes and Save / Change / Delete buttons stay exactly as they are (still "SAP API not configured yet").

## Technical details
- File: `src/routes/_authenticated/imw.distance-master.tsx` only.
- Reuse existing `CustomerSelect` and `getTransportPlantCustConfig` (same plant-customer F4 config, query key `transport-plant-cust-config`, inputs `{ kunnr: [{ plant: row.WERKS }] }`, codeField/textField `KUNNR`).
- Add `updateRow` keyed by `__dmRowKey`; DISTANCE uses shadcn `Input` (`inputMode="decimal"`, `h-8 text-xs`).
- Columns memo depends on `executedCheck` and the F4 config query. DM_GET_API call untouched.
