Rename the Reject button in the Service Entry Sheet screen to UnRelease.

## Context
- The Service Entry Sheet screen (`src/routes/_authenticated/mm.service-entry-sheet.tsx`) renders a "Reject" button above the results table.
- The button triggers `doReject()`, which calls the existing `rejectServiceEntrySheets` server function (UNRELEASE action).
- Only the visible label needs to change; no API, logic, or styling should change.

## Changes
1. In `src/routes/_authenticated/mm.service-entry-sheet.tsx`:
   - Change the button label from `"Reject"` to `"UnRelease"` on line 758.
   - Keep the existing `variant="destructive"`, `onClick={doReject}`, disabled state, and spinner behavior unchanged.
2. Optionally update the related dialog title/validation text from "Reject" to "UnRelease" so the popup remains consistent with the button label, without changing any logic.

## Out of scope
- No changes to `src/lib/mm/ses.functions.ts` or the API payload.
- No changes to Release, Delete, Execute, or other buttons.
- No layout or styling changes.
