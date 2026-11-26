# Distance Master: connect Change to DM_Change_API

## Why the message appears
Change on Distance Master still shows "SAP API not configured yet". The earlier request to connect it stopped before any change was made, so the button was never linked to SAP.

## What will change
- Clicking Change sends all ticked rows to DM_Change_API in one request:
  `{ "user_name": <your SAP user ID>, "modify": [{ MANDT, KUNNR, WERKS, DISTANCE }] }`
- MANDT, KUNNR and WERKS come from each ticked row; DISTANCE is the latest value typed (sent as a number).
- The popup shows only SAP's exact MESSAGE (TYPE S = success, E = error), same as Save.
- After a successful change the table reloads. The button shows "Changing..." while it runs.
- Delete stays as it is.

## Technical details
- Add `getDmChangeConfig` in `src/lib/sap/customer.functions.ts`, mirroring `getDmSaveConfig` (looks up `DM_Change_API`).
- In `src/routes/_authenticated/imw.distance-master.tsx`: add `changing` state and a `change()` function mirroring `save()`, wire it to the Change button.
