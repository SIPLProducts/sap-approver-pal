# Distance Master: connect Change to DM_Change_API

## What changes
- Clicking **Change** (New Record unticked) sends all ticked rows to SAP in one request via DM_Change_API.
- Payload: `{ "user_name": <your SAP user ID>, "modify": [{ MANDT, KUNNR, WERKS, DISTANCE }] }`
  - MANDT kept from the Execute response, KUNNR = Customer, WERKS = Plant, DISTANCE = latest typed value (as a number).
- TYPE "S" = success popup, "E" = error popup; popup shows only SAP's exact MESSAGE.
- After success the table reloads; button shows "Changing…" while busy.
- Delete keeps showing "SAP API not configured yet". Nothing else changes.

## Technical details
- `src/lib/sap/customer.functions.ts`: add `getDmChangeConfig` (copy of `getDmSaveConfig`, name `DM_Change_API`, case-insensitive).
- `src/routes/_authenticated/imw.distance-master.tsx`: add `changing` state and `change()` mirroring existing `save()`; wire the Change button to it.
