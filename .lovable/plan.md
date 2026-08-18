# Service Entry Sheet: Remove Release Code/Group validation on Execute

## What to change

In the Service Entry Sheet screen, allow the user to click **Execute** without selecting a Release Code or Release Group. The SAP call should still be made with empty values when nothing is selected.

## Why

The user wants the selection screen to behave like a free-form search where Release Code/Group are optional filters, not mandatory gates.

## Files & edits

### 1. `src/routes/_authenticated/mm.service-entry-sheet.tsx`

- Remove the client-side guard in the `execute()` function that checks `if (!releaseCode)` and shows the popup "Please select a Release Code before running the selection."
- Keep the rest of the `execute()` body unchanged (payload mapping, loading states, table refresh, scroll behavior).

### 2. `src/lib/mm/ses.functions.ts`

- Change the `releaseCode` input validator from `z.string().trim().min(1, "Release Code is required").max(10)` to an optional string with a default empty string, matching the other optional SAP selection fields (e.g., `z.string().trim().max(10).optional().default("")`).
- `releaseGroup` is already optional with default `""`; leave it unchanged.

## What stays unchanged

- All UI layout, card order, field widths, side-by-side arrangement, and colors.
- The Release/UnRelease/Delete action handlers and their validations (they still require a selected row with an Entry Sheet number).
- The SAP payload mapping, date conversion, and response parsing.
- The results table columns, search bar, and row selection behavior.

## Acceptance

- Clicking **Execute** with no Release Code and no Release Group selected makes the `SES_FETCH_API` call and either shows results or the SAP message popup.
- No "Please select a Release Code" validation popup is shown.
