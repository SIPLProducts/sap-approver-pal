# Service Entry Sheet: live SES_FETCH_API on Execute

## What changes

1. **New server function** `fetchServiceEntrySheetPending` in `src/lib/mm/ses.functions.ts`, using the same SAP config plumbing as PO Release (config lookup by name, proxy/middleware vs direct, credentials, sync logging, error returns).
   - Config name: `SES_FETCH_API` (from SAP API Settings).
   - Sends the documented inputs object, all values as strings, `""` when not supplied:
     `ACTION` = `GET_PENDING`, `RELEASE_CODE`, `RELEASE_GROUP_FROM`, `RELEASE_GROUP_TO` (""),
     `RELEASE_FILTER` (`SET_RELEASE` / `CANCEL_RELEASE`, defaulting to `SET_RELEASE`),
     `PO_FROM/PO_TO`, `DOCUMENT_DATE_FROM/TO` (YYYY-MM-DD converted to YYYYMMDD, blank if empty),
     `PURCHASING_ORG_FROM/TO`, `PURCHASING_GROUP_FROM/TO`, `PLANT_FROM/TO`,
     `MATERIAL_GROUP_FROM/TO`, `ENTRY_SHEET_FROM/TO`,
     `BLOCKED_FILTER` / `ACCEPTED_FILTER` (BLOCKED / NOT_BLOCKED / ALL, ACCEPTED / NOT_ACCEPTED / ALL),
     `SCOPE_OF_LIST`.
   - The remaining Entry Sheet Data fields (External Number, Created On, Model Service Specs, Purchase Requisition, Maintenance Plan, Freight Cost Document) stay on screen but are not sent.
   - Response `{ success, message, recordsFetched, data: [...] }` is parsed with the same DATA/data/array fallback used by PO Release; exact SAP message text is surfaced on failure (reusing the shared `sap-message` helpers) and rows are returned as-is.

2. **Screen** `src/routes/_authenticated/mm.service-entry-sheet.tsx`
   - Existing filters, layout, reset and Release Code validation stay exactly as they are.
   - `execute()` now calls the server function (via `useServerFn`) after the Release Code check.
   - Loading state: Execute disabled with a spinner while in flight.
   - Errors are shown in the existing message dialog with the exact SAP/middleware text — no hardcoded "not connected yet" string.
   - On success a results table renders below the filter cards with columns: Entry Sheet, PO / Item, Supplier, Plant, Material Group, PO Value, Entry Sheet Value, Short Text, Created On (crDate YYYYMMDD formatted readable), Release Code/Group, Release Strategy, Release Indicator, Acceptance, Blocked, Final Entry, Release Option.
   - No table before the first Execute; "No entry sheets found" empty state when `recordsFetched` is 0.

## Technical notes

- Numbers formatted through existing `src/lib/format.ts` helpers (`formatAmount`, `formatDate`).
- No database migrations; `SES_FETCH_API` must exist and be active in SAP API Settings, otherwise the popup reports that clearly.
- No changes to other screens, server functions, or styles.
