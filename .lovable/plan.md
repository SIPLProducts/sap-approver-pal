## Goal
Wire the Save button on the Material Reservation screen to call the `Material_Save_API` (configured in SAP API Settings) with the current header + selected/edited rows and handle the success/failure response.

## Changes

### 1. `src/lib/mm/material-reservation.functions.ts`
Add a new server function `saveMaterialReservation`:
- Input: `{ header, data, user_id }` where `header` has DOCUMENT_NUMBER, HOD_APPROVE, DOCUMENT_DATE, MOVEMENT_TYPE, PLANT, MATERIAL_TYPE; `data` is an array of items with SNO, GOODS_RECEPIENT, MATERIAL, MATERIAL_DESCRIPTION, UOM, ORDER_NUMBER, COST_CENTER, REQUESTED_QUANTITY, APPROVED_QUANTITY, ISSUED_QUANTITY, STORAGE_LOCATION, TOTAL_STOCK, COST_CENT_DESC, HOD_APRROVAL, HOD_REJECTION, REMARKS.
- Loads `Material_Save_API` config + credentials + global settings (mirrors `fetchMaterialReservation`).
- Proxy mode: POST to `{middlewareUrl}/sap/invoke` with `{ configId, inputs: payload }`; direct mode: send payload as JSON body to `cfg.endpoint_url` using configured method (POST default).
- Parses response:
  - Success shape `{ TYPE: "S", DOCUMENT_NUMBER, MESSAGE }` → `{ ok: true, message, documentNumber }`.
  - Failure shape `{ MESSAGES: [{ TYPE: "E", MESSAGE }] }` → `{ ok: false, message }` (join messages).
- Logs to `sap_api_sync_log` (ok/error) like the fetch function.

### 2. `src/routes/_authenticated/mm.material-reservation.tsx`
- Add `useMutation` calling the new `saveMaterialReservation` server function.
- Wire the existing Save button (currently only shows a toast) to build the payload from `header` state, current `rows`, and their edited `rowStates` (HOD_APRROVAL/HOD_REJECTION as `"X"`/`""`, REMARKS from state). Send only rows whose key is in `selected`.
- Include `USER_ID` (auto-filled logged-in SAP user id) and `HOD_APPROVE` flag from the search state.
- Show toast: success (green) with `MESSAGE`; error (red) with joined messages. On success, optionally re-run Execute to refresh the list; keep current search inputs.
- Disable Save while pending; show spinner.

## Out of scope
- No changes to the fetch flow, table layout, or other screens.
- No new SAP API config row is created here; user must add `Material_Save_API` in SAP API Settings (already stated as prerequisite).