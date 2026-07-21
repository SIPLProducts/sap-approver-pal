## Goal

Make the "Release" button on the PR Release screen call `PR_Release_API` for every checked row using the exact payload shape SAP expects, correctly interpret the array response `[{ "MSGTXT": "...", "STATUS": "TRUE"|"FALSE" }]`, toast each row's `MSGTXT`, and remove only the successfully released rows from the table.

## Current state (confirmed from `src/lib/mm/pr-release.functions.ts` and `src/routes/_authenticated/mm.pr-release.tsx`)

- Payload is already built as `{ RELEASE: { BANFN, BNFPO, REL_CODE, REL_GRP, REMARKS } }` per checked row — matches the spec.
- Response handling uses a recursive `findFirst` that walks into nested objects/arrays looking for `STATUS`/`MSGTXT`. For an array response it descends into element 0, which works, but success detection treats only `S / I / SUCCESS / OK / RELEASED` as success. The real SAP response uses `STATUS: "TRUE"` for success and `"FALSE"` for failure (e.g. "already released"), so genuine successes are currently reported as failures and rows never leave the table.
- Optimistic removal is keyed off `ok === true`, so with the wrong success set nothing gets filtered out.
- Middleware transport for POST is already routed through `rawHttpRequestWithBody` (explicit `Content-Length`), so the request itself reaches SAP correctly.

## Fix scope (app code only, `src/lib/mm/pr-release.functions.ts`)

1. Response parsing
   - When the SAP response (post-middleware unwrap via `json.data`) is an array, read element 0 explicitly instead of relying only on recursive descent — this keeps behavior obvious and matches the documented shape `[{ MSGTXT, STATUS }]`.
   - Continue supporting object-shaped responses via the existing `findFirst` fallback.

2. Success detection
   - Extend the `successStatuses` set to include SAP's boolean-style values: `TRUE`, `T`, `Y`, `YES` (keeps the existing `S / I / SUCCESS / OK / RELEASED`).
   - Explicit failure values (`FALSE`, `F`, `N`, `NO`, `E`) map to `ok = false` with `errMsg = msgtxt` so the toast shows SAP's exact reason (e.g. "already released").
   - Empty/missing status still falls back to the current "empty response" / "no status" error paths — unchanged.

3. Row bookkeeping (no UI change needed)
   - `releasePrItems` continues to return `{ preq_no, preq_item, ok, msgtxt, error }` per row.
   - `mm.pr-release.tsx` already:
     - toasts `PR <BANFN>/<BNFPO>: <MSGTXT or error>` per row,
     - filters rows where `ok === true` out of local table state,
     - clears selection + remarks for removed rows,
     - re-fetches the pending list.
   - With the corrected success set, successful rows will now actually disappear; failed rows (including "already released") stay in the table with an error toast — matches the requested behavior.

4. Logging
   - Keep the existing `sap_api_sync_log` insert per row; status becomes `ok` only when `ok && !errMsg`, so logs mirror the new interpretation.

## Out of scope

- No middleware changes (`middleware/server.js`, `response-mapper.js`) — POST transport and `[].FIELD` envelope preservation are already correct.
- No changes to `PR_Release_API` config, payload shape, or the PR Release UI layout, columns, buttons, or fetch flow.
- No changes to other MM screens.

## Verification

- Manual: check a row with a valid PR and click Release → toast shows SAP `MSGTXT`, row disappears, list refreshes.
- Manual: check an already-released row → toast shows "…already released", row stays.
- Existing middleware tests (`bunx vitest run middleware`) still pass; no test changes required for this app-side edit.
