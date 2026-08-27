# SweetAlert popups across MM Approvals

## What changes

All popups in the MM Approvals screens (PR Release, PO Release, MIGO Release, Service Entry Sheet, Gate Pass, ZNFA Rating / Gate Process, Material Reservation, ZNFA Release) are shown as SweetAlert popups, styled to match the app (brand red confirm button, project fonts, subtle borders).

1. **SAP response / error popups** — the same content shown today (reference column such as PO Number / PR / Item / Entry Sheet, the exact SAP message per row, and the collapsible raw response) is rendered inside a SweetAlert popup instead of the current modal card. Messages come straight from the existing API responses — no wording changes, no extra keys, and error-only cases still show only the exact message.

2. **Action confirmations** — before Release, Reject, UnRelease, Post, Delete and Save actions the user gets a SweetAlert confirm popup ("Release 3 selected items?" style) with Confirm / Cancel. Cancel aborts and calls nothing; Confirm runs exactly the same code path as today.

Nothing else changes: payloads, validation, table population, refresh behaviour, and inline field errors all stay as they are. Inline toasts for simple field validation remain untouched.

## Technical notes

- New `src/lib/mm/swal.ts`: a thin wrapper around the already-installed `sweetalert2` exposing `swalSapResponse(state)` and `swalConfirm(options)`, with `customClass` names and brand token styling defined once in `src/styles.css` (red confirm, graphite text, IBM Plex, rounded borders, dark-mode aware).
- `src/components/mm/sap-response-dialog.tsx` keeps its existing props/state contract (`SapResponseDialogState`, `onOpenChange`) but renders nothing and instead fires `swalSapResponse` in an effect when `dialog.open` flips to true, resolving `onOpenChange(false)` on close. This means the six screens already using it need no logic edits.
- `mm.po-release.tsx` and `mm.pr-release.tsx` have their own inline `Dialog` blocks for `responseDialog` / `messageDialog`; those JSX blocks are replaced with the shared `SapResponseDialog` (same data shapes) so they route through Swal too.
- Confirmations use `swalConfirm` awaited at the top of the existing action handlers, guarding the current logic without altering it.
- No API, schema, or RLS changes.
