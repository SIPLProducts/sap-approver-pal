# Distance Master: connect Delete to DM_Delete_API

## What will change
- Clicking Delete sends all ticked rows to DM_Delete_API in one request:
  `{ "user_name": <your SAP user ID>, "delete": [{ MANDT, KUNNR, WERKS, DISTANCE }] }`
- MANDT, KUNNR and WERKS come from each ticked row; DISTANCE is the latest value in the table (sent as a number).
- The popup shows only SAP's exact MESSAGE (TYPE S = success, E = error), same as Save and Change.
- After a successful delete the table reloads. The button shows "Deleting..." while it runs. No extra confirmation, matching Financial Year Base Rate.

## Technical details
- Add `getDmDeleteConfig` in `src/lib/sap/customer.functions.ts`, mirroring `getDmChangeConfig` (looks up `DM_Delete_API`).
- In `src/routes/_authenticated/imw.distance-master.tsx`: add `deleting` state and a `remove()` function mirroring `change()` with key `delete`; wire it to the Delete button and remove the unused `notConfigured` placeholder.
