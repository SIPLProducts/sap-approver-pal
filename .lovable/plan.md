# PO Release — Undo Reject (Cancel Record)

When Cancel Record is ticked, the red button already reads "Undo Reject" but still runs the normal Reject call. This makes it call the real cancel-rejection service instead.

## Behaviour

- Cancel Record ticked: selecting one or more purchase orders and clicking Undo Reject cancels their rejection in SAP.
  - One call per purchase order number (duplicate lines of the same order grouped together).
  - The exact SAP message is shown in the standard response popup.
  - Successful orders are removed from the results list and the list is refreshed with the current Plant / Release Group / Release Code / Cancel Record selection.
  - Failures keep their rows and show the SAP message.
  - No remarks required.
- Cancel Record not ticked: Reject and Release behave exactly as today.
- Filters, pagination, search, plant selection, Execute/Reset and all other APIs stay untouched.

## Technical notes

- `src/lib/mm/po-release.functions.ts`
  - Extend `processPoAction`'s `payloadKey` union with `"CANCEL_REJ"`, building `{ CANCEL_REJ: { EBELN } }` (no FRGCO, no REMARKS).
  - Add `undoPoReject` server fn (`requireSupabaseAuth`, existing `poActionInput` validator) using config name `PO_CANCEL_REJECT` (already present and active, POST `/mm_approve_mng/po_rel/release`), log tag `undo-reject`.
  - Success detection stays the shared logic (`STATUS: "TRUE"`), so the response array `[{ MSGTXT, STATUS, RELSTATUS, INDICATOR }]` is handled by the existing parser.
- `src/routes/_authenticated/mm.po-release.tsx`
  - Import `undoPoReject`; add `undoRejectMutation` mirroring `undoMutation`, with dialog title "PO Undo Reject Response" and default message "Rejection cancelled".
  - Add `onUndoReject()` (same selection mapping as `onUndoRelease`, no confirm dialog needed beyond existing convention for Reject/UnRelease — keep the existing confirm prompt wording adjusted to "Cancel rejection for selected POs?" when Cancel Record is on).
  - Red button: `onClick={cancelRecord ? onUndoReject : onReject}`, pending state includes `undoRejectMutation.isPending`.
