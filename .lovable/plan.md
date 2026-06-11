## Goal
1. On Accept/Reject, actually call the SAP `Price_Approve_Reject` API (via middleware) with the selected rows, then move them into the Accepted/Rejected tab.
2. Move the **Old Price** column to the last position in the table.

## Background — why nothing happened on click today
The current `decide()` only updates local React state — no network call. The `Price_Approve_Reject` SAP config exists (`PUT http://10.150.150.154:8103/.../vk11_app?sap-client=300`) and the middleware already exposes `POST /price_approval/Price_Approve_Reject`. The SAP payload shape (from the configured request fields) is:
```json
{ "APPROV": "X", "REJ": "",  "DATA": [ { "SELECT_FLG":"X", "KEY_COMBINATION":"1", "CONDITION_TYPE":"ZBPL", "CUSTOMER":"...", "PRICE_GROUP":"...", "PLANT":"...", "MATERIAL":"...", "NEW_PRICE":"...", "CURRENCY":"...", "UOM":"...", "CALCULATION_SC":"", "VALID_FROM_SC":"...", "VALID_TO_SC":"...", "OLD_PRICE":"..." } ] }
```
For reject: `APPROV=""`, `REJ="X"`.

## Changes

### 1. `src/lib/sd/price-approval.functions.ts` — add `submitPriceDecision`
New server function `submitPriceDecision({ action: 'accepted'|'rejected', rows: PriceRow[] })`:
- Loads `Price_Approve_Reject` config, creds, global proxy settings (same pattern as `fetchPriceApprovals`).
- Builds SAP payload: `APPROV='X', REJ=''` for accept; `APPROV='', REJ='X'` for reject. `DATA` is the selected rows re-cased to SAP UPPER_SNAKE field names with `SELECT_FLG:'X'`.
- If proxy mode → `PUT/POST {middleware}/price_approval/Price_Approve_Reject` body `{ inputs: <sapPayload> }` (with `x-shared-secret`). 404 fallback to `/sap/invoke` with `{ configId, inputs }` (same pattern as fetch).
- Direct mode → `PUT {endpoint_url}` with JSON body + basic auth.
- Logs to `sap_api_sync_log`. Returns `{ ok, message, sap_response }`.

### 2. `src/routes/_authenticated/sd.price.tsx`
- Use `useServerFn(submitPriceDecision)` inside a `useMutation`.
- `decide(action)` becomes async: call mutation with the selected `PriceRow[]`. On success → mark those keys as `accepted`/`rejected` in `decided`, clear selection, toast "N records accepted/rejected (SAP OK)". On error → toast the error and leave state unchanged so the user can retry. Disable Accept/Reject buttons + show spinner while pending.
- Reorder table header + body cells so **Old Price** appears AFTER `Valid To` (last data column, before the row end). Update colSpan on the empty/loading rows to match.

## Out of scope
No DB schema change, no middleware change (the named route already exists; fallback to `/sap/invoke` covers older deploys). No persistence — accepted/rejected state stays per-fetch as today; persisting across reloads would need a separate decisions table.
