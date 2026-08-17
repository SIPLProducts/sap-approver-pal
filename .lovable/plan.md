# Service Entry Sheet — Release action

Wire the Release button in the Results table to the live `SES_RELEASE_API` and show the exact SAP response in a popup.

## Behaviour

1. User executes the selection, ticks one or more rows in the Results table, clicks **Release**.
2. For each selected row, send one request to `SES_RELEASE_API` with:
   ```text
   { "ACTION": "RELEASE", "ENTRY_SHEET": <entrySh>, "RELEASE_CODE": <relCode> }
   ```
   Entry sheet comes from the row's `entrySh` value; release code from the row's `relCode` (falls back to the selected Release Code in the Release card).
3. Button shows a spinner and stays disabled while the calls run.
4. When all calls finish, a popup lists one line per entry sheet with the exact SAP message text, unmodified:
   - success array form: `[{ status: true, message: "Released Successfully", code: 200, entrySheet: "..." }]`
   - failure object form: `{ success: false, action: "RELEASE", entrySheet: "...", releaseCode: "...", message: "..." }`
   Both shapes are read for `entrySheet` + `message`; if neither is present, the raw response text is shown so nothing is hidden.
5. After the popup is closed, the selection stays as is and the table is left untouched (no auto-refresh), matching the existing screens.

## Technical notes

- Add `releaseServiceEntrySheets` to `src/lib/mm/ses.functions.ts`, following the same shape as `fetchServiceEntrySheetPending`: `createServerFn({ method: "POST" })` + `requireSupabaseAuth`, Zod validation of `{ items: [{ entrySheet, releaseCode }] }`.
- Same config resolution as the fetch function: read `SES_RELEASE_API` from `sap_api_configs`, honour proxy vs direct mode using `sap_global_settings` / `sap_global_secrets`, basic auth and extra headers from `sap_api_credentials`, and log each attempt into `sap_api_sync_log`.
- Return `{ results: [{ entrySheet, ok, message }], error }` — plain DTO only; message strings pass through verbatim (both response shapes handled, plus `MESSAGES`-array/`STATUS: "FALSE"` handling reusing `src/lib/mm/sap-message.ts`).
- In `src/routes/_authenticated/mm.service-entry-sheet.tsx`: add `releasing` state, wire `onClick` on the existing Release button, and reuse the existing dialog (extended to render a list of result lines). Reject and Delete buttons are left unchanged.
- No changes to existing selection, column, or filter logic.
