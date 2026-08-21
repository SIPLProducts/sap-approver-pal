# Service Entry Sheet: hide the Delete button

## Goal
Hide the Delete button from the Service Entry Sheet results action bar by commenting out the button JSX, leaving the rest of the screen and the delete handler intact.

## Changes

### 1. Comment the Delete button in the action bar
**File:** `src/routes/_authenticated/mm.service-entry-sheet.tsx`

- Locate the Delete button in the results action row (after Release and UnRelease).
- Wrap the entire Delete button JSX in `{/* ... */}` so it does not render.
- Keep the existing `onClick={doDelete}`, spinner, and disabled logic unchanged inside the comment.

### 2. Keep supporting code intact
- Leave `deleteServiceEntrySheets` import, `runDelete`, `deleting` state, and `doDelete()` function in the file so the feature can be re-enabled by simply uncommenting the button later.
- Leave Release and UnRelease buttons and their existing behavior unchanged.

## Out of scope
- No changes to business logic, payload, or SAP API calls.
- No changes to other screens or components.
- No changes to table columns, selection, or filters.
