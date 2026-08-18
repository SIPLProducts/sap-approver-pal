# Service Entry Sheet refinements + visible header checkboxes app-wide

## Service Entry Sheet (`src/routes/_authenticated/mm.service-entry-sheet.tsx`)

1. **Entry Sheet Number first**
   - After the dynamic columns are built from the API response, reorder them so the `entrySh` (Entry Sheet Number) column comes first, i.e. immediately after the checkbox column. All other columns keep their current order and labels.

2. **Search bar in the Results header**
   - Add a local `search` state and a search input with the magnifier icon in the Results card header (top-left area, next to the "Entry Sheets" title), styled exactly like the PR Release screen input ("Search results...", `h-9 text-sm pl-8`).
   - Rows are filtered client-side by matching the search text against all displayed cell values; the record count shows `filtered / total` when a search is active, same wording pattern as PR Release.
   - When no row matches, show "No results match your search." inside the table.
   - Selection, action buttons, and the SAP calls are untouched — filtering is display-only.

3. **Auto-refresh after Release / Reject / Delete**
   - After each action's SAP response popup is prepared, re-run the existing Execute fetch (same function the Execute button calls) so the table reflects the new state, and clear the current selection.
   - The popup with the verbatim SAP response still appears; only a refresh call is added.

## Entire application — header checkbox visibility

Table headers are dark indigo (`#2A3F87`) with white text, so the default checkbox (dark border, transparent fill) disappears into the background.

- Add a scoped CSS rule in `src/styles.css` targeting checkboxes inside `thead` (plain tables and the shared table primitives): white border, subtle translucent white fill when unchecked, white box with dark indigo check mark when checked/indeterminate, and a visible focus ring.
- Align the header checkbox vertically with the header text (flex centering on the header cell) in the shared `CloudscapeApprovalTable` and the Service Entry Sheet header cell.
- Body-row checkboxes stay exactly as they are today.

## Out of scope

No changes to payloads, SAP API calls, business logic, permissions, or other screens' behaviour.
