# Service Entry Sheet: full results table, selection, scroll, action buttons

## What changes (screen only)

All work is in `src/routes/_authenticated/mm.service-entry-sheet.tsx`. Filters, validation, reset, and the existing `SES_FETCH_API` call stay exactly as they are.

1. **Show every response field**
   - Replace the fixed 16-column table with columns generated from the returned `data` array using the existing shared helper `buildDynamicColumns` (`src/lib/sd/dynamic-columns.tsx`), so every key present in the API rows becomes a column (dates and amounts formatted, identifiers left as text).
   - Rows come straight from the API `data` array — no filtering or reshaping.

2. **Single-line cells**
   - Table cells render on one line with no wrapping; the table scrolls horizontally as it does today.

3. **Checkbox first column**
   - Render results through the shared `CloudscapeApprovalTable` used by PO Release, with selection enabled (header select-all plus per-row checkbox) as the first column.

4. **Action buttons above the table, right aligned**
   - Release, Reject, Delete appear in the results header row, enabled only when at least one row is selected.
   - Buttons are UI only for this step (no SAP call yet), per your confirmation.

5. **Auto-scroll to results**
   - After a successful Execute, the page scrolls smoothly to the results card.

6. **Message popup**
   - The `message` returned by the API (e.g. "1 records fetched") is shown in the existing message dialog after Execute completes.

## Technical notes

- `fetchServiceEntrySheetPending` already returns `{ data, recordsFetched, message, error }`; the screen just starts using `message` and the full row objects. No server-function or payload change.
- New local state: `selectedKeys: Set<string>`; a `ref` on the results card for scrolling; row key derived from `entrySh` + index.
- Empty state stays "No entry sheets found" when zero records; no table before the first Execute.
- No database, styling, or other-screen changes.
