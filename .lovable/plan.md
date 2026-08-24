# Service Entry Sheet: restore default selections on load

## Goal
When the Service Entry Sheet screen opens, pre-select the standard options so the user sees the same defaults as before the previous "clear defaults" change. The user must still be able to change or clear any of them.

## Changes

### 1. Default initial state
**File:** `src/routes/_authenticated/mm.service-entry-sheet.tsx`

Update the `useState` initial values in `ServiceEntrySheetPage`:

- `setRelease` -> initial value `true` (so "Set Release" is ticked on load)
- `blocking` -> initial value `"not_blocked"` (so "Not Blocked" is selected)
- `acceptance` -> initial value `"not_accepted"` (so "Not Accepted" is selected)

`cancelRelease` stays `false`.

### 2. Reset mirrors the same defaults
In the existing `reset()` function, set the same values as the initial state above:

- `setSetRelease(true)`
- `setBlocking("not_blocked")`
- `setAcceptance("not_accepted")`
- `setCancelRelease(false)`

### 3. Keep everything else unchanged
- No changes to the radio/checkbox rendering, labels, or mutual-exclusivity logic.
- No changes to the SAP payload, Execute flow, results table, Release/UnRelease/Delete handlers, or any other screen.
- No changes to styling, layout, or business logic.
