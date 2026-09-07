# PO Release — Undo Release (Cancel Record)

## What changes

On the PO Release screen, when **Cancel Record** is ticked, the **Undo Release** button becomes functional: select one or more rows, click it, and the app cancels the existing release for each selected purchase order in SAP and shows the exact SAP message in the response popup. Successfully cancelled rows drop out of the list and the list refreshes.

When Cancel Record is not ticked, nothing changes — Release and Reject behave exactly as today.

## Behaviour details

- Undo Release only runs when Cancel Record is ticked and at least one row is selected; Release Group and Release Code stay required as today.
- One call per purchase order number (deduplicated), like the existing release flow; every selected line of that order gets the same result.
- Popup shows the exact SAP message text (e.g. "Release M1 cancelled successfully for Purchase Order 100109976"). Success is judged from the returned status flag; anything else is treated as a failure and the row stays in place.
- Undo Reject keeps its current behaviour (label only) — this plan covers Undo Release, as requested.
- No changes to filters, pagination, search, remarks, plant selection, or existing APIs.

## Technical notes

- Reuse the existing saved connection `PO_CANCEL_RELEASE` (POST `/mm_approve_mng/po_rel/release`), already active.
- Add `undoPoRelease` to `src/lib/mm/po-release.functions.ts`, following the existing `processPoAction` shape (same auth middleware, proxy/basic handling, sync logging, message extraction) with payload `{ YCANCEL: { EBELN, FRGCO } }` where `FRGCO` is the selected Release Code.
- Parse the array response, reading `MSGTXT`, `STATUS`, `RELSTATUS`, `INDICATOR`; `STATUS: "TRUE"` counts as success (existing success/failure status sets already cover this).
- In `src/routes/_authenticated/mm.po-release.tsx`, add an `undoMutation` mirroring `releaseMutation` (popup titled "PO Undo Release Response", clear cancelled rows, re-run the fetch) and wire the Undo Release button to it only while `cancelRecord` is true.
