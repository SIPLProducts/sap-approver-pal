# Material Reservation — one HOD choice per row + exact SAP error popup

## 1. Mutually exclusive HOD checkboxes (new change)

In the results table, each row has HOD Approval and HOD Rejection checkboxes. Today both can be ticked at the same time.

Change (UI only, in `src/routes/_authenticated/mm.material-reservation.tsx`):
- Ticking HOD Approval clears HOD Rejection for that row.
- Ticking HOD Rejection clears HOD Approval for that row.
- Unticking either leaves the row with neither selected.

This is done inside the two `onCheckedChange` handlers via the existing `updateRow` helper, so the save payload mapping (`HOD_APRROVAL` / `HOD_REJECTION` as `"X"` / `""`) stays exactly as it is.

## 2. Exact SAP MESSAGE popup on Save (already verified in place)

Confirmed by reading `src/lib/mm/material-reservation.functions.ts`:
- The save handler already parses nested / array-wrapped / double-encoded responses and uses `collectSapMessages` + `extractMessagesArrayError` from `src/lib/mm/sap-message.ts`.
- For `{"MESSAGES":[{"TYPE":"E","MESSAGE":"..."}]}` it returns `{ ok: false, message: "<exact MESSAGE>" }`.
- `SapResponseDialog` (SweetAlert) renders only that message text; the raw response block was already removed.

So the popup shows only `Requested quantity should be lessthan or equal to total stock`. No change needed here; if a stale build shows otherwise, a refresh picks it up.

## Untouched
Fetch/save payloads, API calls, success handling, list refresh, selection reset, and every other MM screen.
