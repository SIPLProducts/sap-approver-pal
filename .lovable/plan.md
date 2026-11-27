# Vehicle Master – connect Save to VM_SAVE_API

## What changes
- Save button (shown in New Record mode) calls VM_SAVE_API from SAP API Settings instead of showing "SAP API not configured yet".
- One request with all ticked rows:
  `{ user_name, SAVE: [{ WERKS, VEHICLENO, VEHICLECAP, NETWT, VEH_CAP, VEH_TYPE, TRANSPORT_NAME }] }`
- Values are the latest typed/selected ones (including the row Plant picked in F4). VEHICLECAP and NETWT sent as numbers; others as text.
- Popup shows only SAP's MESSAGE (green for S, red for E). After success the table reloads via Execute.
- Button shows "Saving…" while pending. Change and Delete stay as they are.

## Technical details
- `src/lib/sap/customer.functions.ts`: add `getVmSaveConfig` (same as `getDmSaveConfig`, key `VM_SAVE_API`).
- `src/routes/_authenticated/imw.vehicle-master.tsx`: add `saving` state, `showSapResult` helper and `save()` copied from Distance Master's `save()`, with the field mapping above; wire to Save button only.
