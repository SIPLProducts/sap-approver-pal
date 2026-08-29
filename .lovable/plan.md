# SES results table restyle + ZNFA status icons

## 1. Service Entry Sheet — results table matches ZNFA Rating

In `src/routes/_authenticated/mm.service-entry-sheet.tsx`, replace the hand-built
`<table>` block in the Results card with the shared `CloudscapeApprovalTable`
component already used by the ZNFA Rating screen, so both screens look and behave
identically (sticky dark header, built-in search box, selection checkboxes,
pagination, empty/loading states).

Kept exactly as-is:
- The same dynamic columns (including Entry Sheet Number moved first, DD-MM-YYYY
  date formatting, header labels).
- The same row key, selection state, and Release / UnRelease (and commented-out
  Delete) buttons — they move into the table's header area, same handlers, same
  enable/disable rules.
- Fetch payload, filters, validation, scroll-to-results, and message popups.

Note: the shared table has its own search field, so the current custom search
input is removed to avoid two search boxes (search behaviour itself is unchanged).

## 2. ZNFA Release — Status icons in the Approval / Release Matrix

In the same file's `DetailsTableCard`, add an optional `statusIcon` flag on the
column definition and set it on the `STATUS` column of `REL_MATX_COLUMNS`.
Cell rendering maps the SAP code to a small icon with the raw code as tooltip /
accessible label:

- `@01@` → small green check icon
- `@02@` → small red cross icon
- `@5D@` → small amber exclamation icon
- anything else → current plain text

This applies to Release, Display, and Approval List modes since all three feed
the same matrix table.

## Technical notes

- No server function, payload, or data-shape changes in either screen.
- Icons come from the existing `lucide-react` set (`CircleCheck`/`Check`,
  `X`, `TriangleAlert`), sized `h-4 w-4`, colored with existing semantic tokens.
