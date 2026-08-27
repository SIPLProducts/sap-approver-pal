# PO Release remarks + Gate Pass manual number entry

## 1. PO Release — Reject without Remarks

Verified current state: the Reject flow in `src/routes/_authenticated/mm.po-release.tsx` has no Remarks validation, and the server validator (`poActionInput`) already declares `REMARKS` as optional with a default of `""`. Rejecting with blank Remarks already works, so no change is required here.

If a blocking message still appears in your environment, it is coming back from SAP itself (shown in the response popup), not from the app.

## 2. Gate Pass — Return Receipt uses manual Gate Pass Number entry

Behaviour after the change:
- Selecting the Return Receipt checkbox switches the Gate Pass Number field from the F4 dropdown to a plain text input the user types into.
- `Gate_Pass_Doc_F4_API` is still not called in that mode (unchanged; the F4 component is simply not rendered).
- HOD / Store / SCM / Plant Head continue to show the existing searchable F4 dropdown exactly as today.

Technical change, in `src/routes/_authenticated/mm.gate-pass.tsx` only:
- In the "Gate Pass Number" field block, render conditionally on the existing `returnReceipt` flag: when true, render an `Input` bound to `gatePassNumber` / `setGatePassNumber` (mono text, placeholder "Enter gate pass number"); otherwise render the existing `GatePassNumberSelect` unchanged.

No changes to Execute/Save payloads, field-locking logic, selection rules, or any server function.
