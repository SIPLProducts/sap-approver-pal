# ZNFA Release: exact MSG in Swal for Approve / Reject

In the ZNFA Release screen (Release action), after results load and the user clicks **Approve** or **Reject**, the SAP response `MSG` key must be shown verbatim in the same SweetAlert popup used elsewhere — for both success and failure.

## Current behavior

- **Failure** (`res.ok === false`): already opens a Swal popup (`showSapError`) with the exact MSG. No change.
- **Success**: the exact SAP `MSG` is only shown as a transient `toast.success(...)`, not in the Swal popup.

## Change

### `src/routes/_authenticated/mm.znfa-release.tsx`

1. Generalize the existing `showSapError(title, message, ref?)` helper to accept an `ok` flag (default `false`) so the dialog row carries success/failure styling (green/red), e.g. `showSapResponse(title, message, ref?, ok = false)`. `showSapError` keeps its current call signature by delegating, so no existing call sites change.
2. `approveMutation.onSuccess` success branch: instead of (only) `toast.success(msg ?? "NFA released...")`, open the Swal popup with title `ZNFA Release Response`, the NFA number as ref, the exact `res.sapMessage` (fallback: `res.error`, then "NFA released"), `ok: true`.
3. `rejectMutation.onSuccess` success branch: same, with title `ZNFA Reject Response` and fallback "NFA rejected".

No server-function changes: `approveZnfa` already returns the exact `sapMessage` (MSG key) for both success and failure paths.

Everything else stays unchanged: reject reason dialog, list refresh after success (`releaseMutation.mutate`), `onDocBack()` navigation, error toasts on network/unexpected errors.

## Technical notes

- The popup is the existing `SapResponseDialog` fed via `setSapDialog(...)`; setting `ok: true` on the row renders the success styling, and `swalSapResponse` picks the `success` icon when no row is an error.
- Row removal/refresh, confirm/reject dialogs, payloads, and SAP message extraction are untouched.
