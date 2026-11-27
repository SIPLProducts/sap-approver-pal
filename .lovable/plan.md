# Vehicle Master – connect Change to VM_CHANGE_API

## What changes
- Change button (shown when New Record is unticked) calls VM_CHANGE_API from SAP API Settings instead of "SAP API not configured yet".
- One request with all ticked rows:
  `{ user_name, modify: [{ MANDT, WERKS, VEHICLENO, VEHICLECAP, NETWT, VEH_CAP, VEH_TYPE, TRANSPORT_NAME }] }`
- MANDT, Plant and Vehicle Number come from the loaded row (still read-only); the other five use the latest edited values. VEHICLECAP and NETWT sent as numbers.
- Popup shows only SAP's MESSAGE (green S, red E). After success the table reloads. Button shows "Changing…" while pending. Delete stays as is.

## Technical details
- `customer.functions.ts`: add `getVmChangeConfig` (key `VM_CHANGE_API`), same shape as `getVmSaveConfig`.
- `imw.vehicle-master.tsx`: add `changing` state and `change()` mirroring `save()`, reusing `showSapResult`; wire to Change button only.
