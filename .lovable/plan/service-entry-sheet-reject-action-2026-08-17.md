# Service Entry Sheet Reject Action

## Goal
Add a Reject action to the Service Entry Sheet screen that calls the `SES_REJECT_API` configured in SAP API Settings and displays the exact SAP response in a popup.

## Changes

### 1. Backend server function
**File:** `src/lib/mm/ses.functions.ts`

Add a new `rejectServiceEntrySheets` server function next to `releaseServiceEntrySheets`.
- Config name: `SES_REJECT_API`
- Input: array of `{ entrySheet, releaseCode }` (same as release)
- Payload per item: `{ ACTION: "UNRELEASE", ENTRY_SHEET, RELEASE_CODE }`
- Response handling:
  - Success array form: `[{ status: true, message, code, entrySheet }]` → `ok: true`
  - Failure object form: `{ success: false, action: "UNRELEASE", entrySheet, releaseCode, message }` → `ok: false`
  - Network / non-2xx → `ok: false`
- Return shape: `{ results: { entrySheet, ok, message }[], error: string | null }` (same as release)

### 2. UI wiring
**File:** `src/routes/_authenticated/mm.service-entry-sheet.tsx`

- Import `rejectServiceEntrySheets` from `src/lib/mm/ses.functions.ts`.
- Add `const runReject = useServerFn(rejectServiceEntrySheets)`.
- Add `const [rejecting, setRejecting] = useState(false)`.
- Implement `doReject()` by copying the `doRelease()` pattern, building selected items from checked rows, calling `runReject({ data: { items } })`, and showing results in `messageDialog` with title "Reject".
- Enable the Reject button: `onClick={doReject}`, `disabled={selectedKeys.size === 0 || rejecting}`, and show a spinner while `rejecting`.
- Leave the existing Release logic, table layout, and popup dialog unchanged.

## Out of scope
- Delete button action remains a stub (no change requested).
- No changes to the Execute / fetch logic or table columns.
- No changes to styling, layout, or other screens.
