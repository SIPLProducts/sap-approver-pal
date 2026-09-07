# PR Release — Undo Reject (Cancel Record)

When Cancel Record is ticked, the red button already reads "Undo Reject" but still runs the normal Reject call. This makes it call the real cancel-rejection service.

## Behaviour

- Cancel Record ticked: selecting one or more requisition lines and clicking Undo Reject cancels their rejection in SAP.
  - One call per PR number (duplicate lines of the same PR grouped together), since the payload only carries the PR number.
  - The exact SAP message is shown in the standard response popup.
  - Successfully cancelled rows are removed from the results list, then the list refreshes with the current Plant / Release Group / Release Code / Cancel Record selection.
  - Failures keep their rows and show the SAP message.
  - No remarks required.
- Cancel Record not ticked: Reject and Release behave exactly as today.
- Filters, pagination, search, plant selection, Execute/Reset and all other APIs stay untouched.

## Technical notes

- `src/lib/mm/pr-release.functions.ts`
  - Extend `processPrAction`'s `payloadKey` union with `"CANCEL_REJ"`, building `{ CANCEL_REJ: { BANFN } }` only (no BNFPO, no REL_CODE/REL_GRP, no REMARKS), de-duplicated by PR number so one request goes out per PR.
  - Add `undoPrReject` server fn (`requireSupabaseAuth`) using config name `PR_CANCEL_REJECT` (POST `/mm_approve_mng/pr_rel/release`), log tag `undo-reject`, validator allowing blank `relgroup`/`relcode`.
  - Success detection stays the shared logic (`STATUS: "TRUE"`), so `[{ MSGTXT, STATUS }]` is handled by the existing parser.
- `src/routes/_authenticated/mm.pr-release.tsx`
  - Import `undoPrReject`; add `undoRejectMutation` mirroring `undoMutation`, dialog title "PR Undo Reject — SAP Response", removing rows for every PR number that succeeded, then re-fetching.
  - Add `onUndoReject()` using the same selection mapping as `onUndoRelease`.
  - Red button: `onClick={cancelRecord ? onUndoReject : onReject}`, disabled/spinner state includes `undoRejectMutation.isPending`.
