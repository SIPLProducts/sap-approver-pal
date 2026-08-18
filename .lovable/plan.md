# Service Entry Sheet: Send optional filters only when selected

## What to change

Update the `Execute` payload for the Service Entry Sheet screen so that `BLOCKED_FILTER`, `ACCEPTED_FILTER`, and `RELEASE_FILTER` are sent based only on the user's current selection. When no option is selected, send an empty string (`""`) instead of the previous defaults (`ALL`, `SET_RELEASE`).

## Files & edits

### 1. `src/routes/_authenticated/mm.service-entry-sheet.tsx`

In the `execute()` function, change the payload mapping for these three fields only:

- `releaseFilter`:
  - `setRelease` checked → `"SET_RELEASE"`
  - `cancelRelease` checked → `"CANCEL_RELEASE"`
  - neither checked → `""`
- `blockedFilter`:
  - "Blocked" selected → `"BLOCKED"`
  - "Not Blocked" selected → `"NOT_BLOCKED"`
  - "All" selected → `"ALL"`
  - nothing selected → `""`
- `acceptedFilter`:
  - "Accepted" selected → `"ACCEPTED"`
  - "Not Accepted" selected → `"NOT_ACCEPTED"`
  - "All" selected → `"ALL"`
  - nothing selected → `""`

All other payload fields, state handling, loading states, error handling, and table behavior remain unchanged.

### 2. `src/lib/mm/ses.functions.ts`

Update the `fetchServiceEntrySheetPending` input validator so it accepts the empty-string values sent from the client and defaults to empty string when absent:

- `releaseFilter`: allow `"SET_RELEASE" | "CANCEL_RELEASE" | ""`, default `""`
- `blockedFilter`: allow `"BLOCKED" | "NOT_BLOCKED" | "ALL" | ""`, default `""`
- `acceptedFilter`: allow `"ACCEPTED" | "NOT_ACCEPTED" | "ALL" | ""`, default `""`

The handler continues to place these values directly into the SAP `inputs` object, so the actual request body will now contain `""` for unselected filters and the correct SAP value for selected filters.

## What stays unchanged

- UI layout, cards, fields, widths, and side-by-side arrangement.
- Release/UnRelease/Delete action handlers and their validations.
- Results table columns, search, row selection, and scroll-to-results behavior.
- `SCOPE_OF_LIST` continues to default to `ENTRY_REL` as a normal input field.
- Reset logic, loading states, and message dialogs.

## Acceptance

- Clicking `Execute` with no Release/Blocking/Acceptance options selected sends `"RELEASE_FILTER": ""`, `"BLOCKED_FILTER": ""`, and `"ACCEPTED_FILTER": ""`.
- Selecting a radio/checkbox option sends the matching SAP value (e.g., `"BLOCKED"`, `"NOT_ACCEPTED"`, `"SET_RELEASE"`).
- Selecting "All" for Blocking or Acceptance still sends `"ALL"`.
- The API call, response parsing, and table behavior remain the same.
