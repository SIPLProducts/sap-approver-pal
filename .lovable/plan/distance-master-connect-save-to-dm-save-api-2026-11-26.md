# Distance Master: connect Save to DM_SAVE_API

## What changes
- Clicking **Save** (New Record mode) sends all ticked rows in one request to DM_SAVE_API:
  `{ "SAVE": [{ user_name, KUNNR, WERKS, DISTANCE }] }`
  - user_name = logged-in user's SAP ID
  - KUNNR / WERKS = row's Customer / Plant
  - DISTANCE = the latest Distance typed in that row (sent as a number)
- Popup shows only SAP's exact MESSAGE; TYPE "S" = success, "E" = error.
- Button shows "Saving…" while running; after a successful save the table reloads via Execute.
- Change and Delete stay as "SAP API not configured yet".

## Technical details
- `src/lib/sap/customer.functions.ts`: add `getDmSaveConfig` (same as `getAverageSellingSaveConfig`, name `DM_SAVE_API`, returns configId + userName).
- `src/routes/_authenticated/imw.distance-master.tsx`: add `saving` state, `showSapResult` helper and `save()` copied from Average Selling Rate / FYBR; wire only the Save button to `save`. Config is already saved (POST), so no settings/sync-script changes.
