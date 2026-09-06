# PO Release — Cancel Record option

## What changes for the user

- A **Cancel Record** checkbox appears next to the Release Code field in the PO Release selection screen.
- When it is ticked and **Execute** is pressed, the PO fetch asks SAP for cancellable records instead of the normal pending list; the results table fills from the same response and all existing behaviour (search, selection, Release, Reject, error popups) stays exactly as it is.
- When it is not ticked, the screen behaves exactly as today.

## Verified current state

- `fetchPoGet` in `src/lib/mm/po-release.functions.ts` calls the `PO_GET_API` config once per selected plant with body `{ GET: { WERKS, FRGGR, FRGCO } }` and collects rows from an array response (top level, `DATA` or `data`), with `extractFalseStatusMessage` handling STATUS FALSE.
- The payload today has no `CANCEL_REC` and no `USER_ID`.
- The results table builds its columns dynamically from the returned row keys, so the shorter cancel response (EBELN, BATXT, PLANT_CODE, PLANT_NAME, RLWRT, WAERS) renders without table changes.
- The signed-in SAP user id is available on the client from the stored SAP profile (`use-sap-profile`), the same source other MM screens use.

## Technical changes

1. `src/lib/mm/po-release.functions.ts` — `fetchPoGet` validator gains optional `cancel_record: boolean` (default `false`) and optional `user_id: string`. The per-plant body becomes:
   `{ GET: { WERKS, FRGGR, FRGCO, CANCEL_REC: cancel_record ? "X" : "", USER_ID: user_id ?? "" } }`.
   Response parsing, status/message extraction, logging, proxy handling and every other server function (`releasePoItems`, `rejectPoItems`, `fetchPoReleaseMultiple`) are untouched.
2. `src/routes/_authenticated/mm.po-release.tsx` — add `cancelRecord` state and a `Checkbox` + `Label` ("Cancel Record") placed after the Release Code control in the same grid row; pass `cancel_record` and the SAP profile user id in the existing `mutation.mutate({...})` calls; `reset()` sets it back to `false`. Add `PLANT_CODE: "Plant"` to `COLUMN_LABELS` so the cancel response column reads nicely.

No database, API config, or other screen changes.
