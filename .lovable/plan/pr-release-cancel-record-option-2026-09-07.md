# PR Release — Cancel Record option

## What changes for the user

- A **Cancel Record** checkbox appears next to the Release Code field on the PR Release selection screen.
- When it is ticked and **Execute** is pressed, the fetch asks SAP for PR cancellation records instead of the normal pending list. The results table fills from the same response, and search, row selection, Release, Reject and error popups all behave exactly as today.
- When it is not ticked, the screen behaves exactly as today.

## Verified current state

- `fetchPrReleaseMultiple` in `src/lib/mm/pr-release.functions.ts` sends `PLANT`, `RELGROUP`, `RELCODE` per selected plant (query params in direct mode, `inputs` via proxy) and has no `CANCEL_REC` or `USER_ID`.
- `mm.pr-release.tsx` calls `mutation.mutate({ relgroup, relcode, plants })` in three places (Execute, and the post-action refreshes) and builds table columns dynamically from the returned row keys, so the cancel response renders without table changes.
- The signed-in SAP user id is available on the client from the stored SAP profile (`use-sap-profile`), same as PO Release.

## Technical changes

1. `src/lib/mm/pr-release.functions.ts` — validator gains optional `cancel_record: boolean` (default `false`) and optional `user_id: string` (default `""`). The per-plant `inputs` object adds `CANCEL_REC: cancel_record ? "X" : ""` and `USER_ID: (user_id ?? "").trim()`. Response parsing, TYPE=E handling, logging, proxy handling and the release/reject functions stay untouched.
2. `src/routes/_authenticated/mm.pr-release.tsx` — add `cancelRecord` state and a `Checkbox` + `Label` ("Cancel Record") after the Release Code control in the same grid row; read the SAP user id with `useSapProfile()`; pass `cancel_record` and `user_id` in all three `mutation.mutate({...})` calls; `reset()` sets `cancelRecord` back to `false`. Add friendly labels for any new response keys (`C_AMT_BAPI` → Valuation Price, `RLWRT` → Total Value, `PR_REL_STAT` → Release Status) to `COLUMN_LABELS` if not already present.

No database, API config, or other screen changes.
