# PR Release — Undo Release (Cancel Record)

When Cancel Record is ticked on PR Release, the green button already reads "Undo Release" but still runs the normal Release call. This makes it call the real cancel-release service.

## Behaviour

- Cancel Record ticked: select one or more requisition lines and click Undo Release — each selected line's release is cancelled in SAP.
  - One call per PR number + item.
  - The exact SAP message is shown in the standard response popup.
  - Successfully cancelled lines are removed from the list and the list is refreshed with the current Plant / Release Group / Release Code / Cancel Record selection.
  - Failures keep their rows and show the SAP message.
  - No remarks required. Release Code stays required; Release Group is sent as blank per the given payload.
- Cancel Record not ticked: Release and Reject behave exactly as today.
- Undo Reject stays label-only for now.
- Filters, pagination, search, plant selection, Execute/Reset and all other APIs stay untouched.

## Technical notes

Verified: saved connection `PR_CANCEL_RELEASE` exists and is active — POST `/mm_approve_mng/pr_rel/release?sap-client=300`.

- `src/lib/mm/pr-release.functions.ts`
  - Extend `processPrAction`'s `payloadKey` union with `"YCANCEL"`; for that key build `{ YCANCEL: { BANFN, BNFPO, REL_CODE: relcode, REL_GRP: "" } }` (no REMARKS). RELEASE/REJECT payloads unchanged.
  - Add `undoPrRelease` server fn (`requireSupabaseAuth`, existing `prActionInput` validator) using config `PR_CANCEL_RELEASE`, log tag `undo-release`.
  - Existing success detection covers `STATUS: "TRUE"` and existing `MSGTXT` extraction handles the array response.
- `src/routes/_authenticated/mm.pr-release.tsx`
  - Import `undoPrRelease`; add `undoMutation` mirroring `releaseMutation` with dialog title "PR Undo Release — SAP Response" and default message "Release cancelled"; clear cancelled rows and re-run the fetch with the current selection including `cancel_record`.
  - Add `onUndoRelease()` using the same selection mapping as `onRelease` (no remarks).
  - Green button: `onClick={cancelRecord ? onUndoRelease : onRelease}`, pending state includes `undoMutation.isPending`.
