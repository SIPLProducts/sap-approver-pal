# Vehicle Master – connect Delete to VM_Delete_API

## What changes
- Delete button (New Record unticked) calls VM_Delete_API from SAP API Settings instead of "SAP API not configured yet". No confirmation dialog, same as Distance Master.
- One request with all ticked rows:
  `{ user_name, delete: [{ MANDT, WERKS, VEHICLENO, VEHICLECAP, NETWT, VEH_CAP, VEH_TYPE, TRANSPORT_NAME }] }`
- Each row's data is sent as shown in the table, MANDT included; VEHICLECAP and NETWT as numbers.
- Popup shows only SAP's MESSAGE (green S, red E). After success the table reloads. Button shows "Deleting…" while pending.

## Technical details
- `customer.functions.ts`: add `getVmDeleteConfig` (key `VM_Delete_API`, case-insensitive match).
- `imw.vehicle-master.tsx`: add `deleting` state and `remove()` mirroring `change()` with key `delete`; wire to Delete; remove the now-unused `notConfigured`.
