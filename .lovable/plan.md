## MIGO Release — align payload & UI

### Server (`src/lib/mm/migo-release.functions.ts`)
- `fetchMigo` inputValidator: drop `user_id`; keep `mat_doc_number` (required) and `mat_doc_year` (required).
- Build payload as `{ mblnr: <matDocNo>, mjahr: <matDocYear> }` (lowercase keys, exact shape).
- Send as POST JSON to the SAP endpoint (both direct and via proxy). Remove GET querystring path and the `USER_ID` field.
- Response parsing already handles `{ HEADER: {...}, DATA: [...] }` where HEADER can be an object OR array — keep current normalization (HEADER object → wrap; DATA → rows). Drop `user_id` from return.
- `saveMigo`: remove `user_id` requirement (leave the rest untouched to preserve existing save flow).

### UI (`src/routes/_authenticated/mm.migo-release.tsx`)
- Remove the User ID input field and related state, query for `getMySapUserId`, and the readonly rendering.
- Adjust selection-screen grid to two inputs + actions (mirroring Material Reservation's layout without the plant field).
- Execute validates only Material Document Number (year optional or required — keep required to match example; will use required).
- Remove `user_id` from `fetchFn` and `saveFn` mutation payloads.
- Header card: render HEADER object fields as read-only inputs (already implemented) — unchanged.
- Results table: unchanged (dynamic columns + HOD Approval/Rejection + Remarks + Save).

### Out of scope
- No changes to Material Reservation, sidebar, or other screens.
- No business-logic changes to save flow beyond removing `user_id`.

### Technical notes
- Endpoint config lookup remains `MIGO_FETCH_API` (fetch) and `MIGO_SAVE_API` (save) from `sap_api_configs`.
- Proxy body becomes `{ configId, inputs: { mblnr, mjahr } }`; middleware forwards `inputs` as JSON body to SAP.
