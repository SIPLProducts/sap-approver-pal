# ZNFA Release: show clicked NFA Number in Approve/Reject popup

## Problem
After Approve or Reject, the popup's "NFA Number" column is filled from the SAP response's number field, which is often empty or not the record the user opened, so it shows "—" or a wrong value.

## Change (only `src/routes/_authenticated/mm.znfa-release.tsx`)
- In `approveMutation.onSuccess` and `rejectMutation.onSuccess`, read the mutation variables (`(res, vars) => ...`) and pass `vars.znfaNum` — the NFA Number the user clicked/opened and sent to SAP — as the popup's NFA Number, for both success and failure popups.
- Fall back to `res.number` only if `vars.znfaNum` is empty.

## Unchanged
Payloads, SAP message text, success/error styling, reject reason dialog, list refresh, back navigation, and all UI design.
