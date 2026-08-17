# Service Entry Sheet Delete Action

## Goal
Add a Delete action to the Service Entry Sheet screen that calls the `SES_DELETE_API` configured in SAP API Settings and displays the exact SAP response in the same popup used by Release and Reject.

## Changes

### 1. Backend server function
**File:** `src/lib/mm/ses.functions.ts`

Add a new `deleteServiceEntrySheets` server function next to `rejectServiceEntrySheets`.
- Config name: `SES_DELETE_API`
- Input: array of `{ entrySheet }` (Delete does not need release code)
- Payload per item: `{ ACTION: "delete", ENTRY_SHEET }`
- Response handling:
  - Success array form: `[{ status: true, message, code, entrySheet }]` → `ok: true`
  - Failure object form: `{ success: false, action: "DELETE", entrySheet, releaseCode, message }` → `ok: false`
  - Network / non-2xx → `ok: false`
- Return shape: `{ results: { entrySheet, ok, message }[], error: string | null }` (same as release/reject)
- Log each call to `sap_api_sync_log` with `rows_processed: 1` and status `ok`/`error`.

### 2. UI wiring
**File:** `src/routes/_authenticated/mm.service-entry-sheet.tsx`

- Import `deleteServiceEntrySheets` from `src/lib/mm/ses.functions.ts`.
- Add `const runDelete = useServerFn(deleteServiceEntrySheets)`.
- Add `const [deleting, setDeleting] = useState(false)`.
- Implement `doDelete()` by copying the `doRelease()` pattern, building selected items from checked rows using only `entrySh`, calling `runDelete({ data: { items } })`, and showing results in `messageDialog` with title "Delete".
- Enable the Delete button:
  - Change `variant="outline"` to `variant="destructive"` to match the destructive action.
  - Set `onClick={doDelete}`.
  - Set `disabled={selectedKeys.size === 0 || deleting}`.
  - Show `Loader2` spinner while `deleting`.
- Leave the existing Release/Reject logic, table layout, and popup dialog unchanged.

## Out of scope
- No changes to the Execute / fetch logic or table columns.
- No changes to styling, layout, or other screens.
- No changes to existing Release/Reject code.
