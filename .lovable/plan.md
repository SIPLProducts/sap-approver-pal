## Changes

### 1. `src/lib/mm/gate-pass.functions.ts`
Add a new `saveGatePass` server function (alongside existing `fetchGatePass`).
- Config name: `Gate_Pass_Save_API`. Same config/creds/global-settings/proxy resolution pattern as `fetchGatePass` and `saveMaterialReservation`.
- Zod input:
  - `header`: object with `GATEPASS_NUMBER` (string/number, coerced to number when numeric), `GATE_PASS_TYPE`, `GATEPASS_DATE` (YYYYMMDD string), `PLANT`, `VEHICLE_NO`, `VENDOR`, `VENDOR_NAME`, `PURPOSE` — all strings, empty allowed.
  - `data`: array of row objects (pass-through record) — will be normalized in the handler.
- Handler builds the exact payload shape requested:
  ```
  { GATEPASS_NUMBER, GATE_PASS_TYPE, GATEPASS_DATE, PLANT, VEHICLE_NO,
    VENDOR, VENDOR_NAME, PURPOSE, DATA: [ ...rows ] }
  ```
  For each row, project only the SAP-expected keys in the given order: `MATERIAL, DESCRIPTION, MEINS, QUANTITY, VALUE, EXPECTED_DATE_OF_RETURN, USER_REMARKS, HOD_APPROVAL, HOD_REJECTION, HOD_REMARKS, ISSUED_QUANTITY, STORE_APPROVAL, JUSTIFICATION, SCM_HEAD, PH_APPROVAL, PH_REJECTION, RETURN_STATUS, REMARKS, RETURNED_QUANTITY`. Numeric fields (`QUANTITY`, `VALUE`, `ISSUED_QUANTITY`, `RETURNED_QUANTITY`) coerced to Number when parseable, else `0`. Missing string keys default to `""`, checkbox-style keys default to `""`.
- HTTP: default `POST` (fallback to `cfg.http_method`). Same proxy vs direct branching as `saveMaterialReservation`; when proxied, POST `{ configId, inputs: <payload> }` to `${middlewareUrl}/sap/invoke`. When direct, POST JSON body to `cfg.endpoint_url` with basic auth + extra headers.
- Response parsing (supports both documented shapes):
  - Unwrap proxied `{ data: ... }` to `sapJson`.
  - If `sapJson.MESSAGES` is an array: take first entry's `TYPE`/`MESSAGE`. `TYPE === "S"` → success; else error.
  - Else if `sapJson.TYPE === "S"` (legacy single-object shape): success; use `sapJson.MESSAGE`, include `DOCUMENT_NUMBER` if present.
  - Else error with best-effort message.
- Insert a row into `sap_api_sync_log` (ok/error, latency, message) — mirror `saveMaterialReservation`.
- Return `{ ok: boolean, message: string, document_number: string | null, error: string | null }`.

### 2. `src/routes/_authenticated/mm.gate-pass.tsx`
Wire the existing "Save" button to the new server function.
- Import `saveGatePass` and add `const saveFn = useServerFn(saveGatePass)`.
- Add `saveMutation` (`useMutation`) that:
  - Builds `header` from current `header` state (keys listed above; missing → `""`).
  - Builds `data` from selected rows only (filter `rows` by `selected` set using `rowKey`). If nothing selected → toast error "Select at least one row" and abort.
  - Calls `saveFn({ data: { header, data } })`.
  - On success (`ok`): toast success with returned `message` (append doc number when present), clear selection, and re-run the current fetch (`mutation.mutate(...)` with the same selection-screen values) so the table refreshes.
  - On failure: `toast.error(res.error ?? res.message)`.
  - On thrown error: `toast.error(e.message)`.
- Replace the current placeholder Save button `onClick` (which just toasts "Save clicked") with `saveMutation.mutate()`. Disable while `saveMutation.isPending` and show a `Loader2` spinner + "Saving…" label, matching Material Reservation.

## Out of scope
- No change to `fetchGatePass`, selection screen fields, or table columns.
- No change to Material Reservation, PR Release, or other screens.
- No new DB migrations — assumes `Gate_Pass_Save_API` is already configured in SAP API Settings (same assumption as prior save wiring).
