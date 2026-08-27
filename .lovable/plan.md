# Standardize MM error popups + SES "UnRelease" wording

## 1. Shared response dialog (PR/PO Release design)

Create one reusable component, `src/components/mm/sap-response-dialog.tsx`, that matches the existing PR/PO Release popup exactly:

- Title in the header (e.g. "Release Response", "Reject Response", screen-specific).
- Two-column table: **Document / Item** and **Message**, with success rows in green (`text-success`) and failure rows in red (`text-destructive`).
- A collapsible "Raw response" block per row (`<details>` + `<pre>` JSON), falling back to `{ message }` when the server function does not return a raw payload — no server-function changes needed.
- `max-w-2xl`, scrollable body (`max-h-[60vh]`), Close button in the footer.

## 2. Apply it across MM screens (SAP/API responses only)

Replace the current error surfaces with this dialog on:

- `mm.service-entry-sheet.tsx` — replace the simple `messageDialog` (Info icon + plain text) with the shared dialog for fetch errors and Release/UnRelease results. Its existing per-entry-sheet `lines` map directly onto the dialog's table rows.
- `mm.gate-process.tsx` — replace `toast.error(res.error)` for SAP responses (fetch and Rating/Change/Display/Attachments actions) with the popup; keep the existing TYPE "E" exact-MSG text as the row message.
- `mm.gate-pass.tsx` — route SAP error/response messages (currently `messageOnly` dialog + toasts) through the shared dialog.
- `mm.material-reservation.tsx` — SAP fetch/action errors shown via the shared dialog instead of `toast.error`.
- `mm.migo-release.tsx` — same for Get Details / Check / Post SAP responses.
- `mm.znfa-release.tsx` — SAP response errors (fetch, release, display, print) via the shared dialog instead of `toast.error`.

Unchanged everywhere:

- Validation toasts ("Select a plant", "Select at least one row", etc.) stay as toasts.
- `toast.success` messages stay.
- No server-function, payload, RLS, or selection/table logic changes — only how the already-returned message is displayed. Where a server function returns only a message string, the popup shows that message in the table and the raw block falls back to `{ message }`.

## 3. Service Entry Sheet — "UnRelease" wording

In `mm.service-entry-sheet.tsx`, change the popup title/text that still says "Reject" to "UnRelease" (the empty-selection message, the error popup titles, and the "Could not reject…" fallback text). The button already reads "UnRelease"; no logic changes.

## Out of scope

- No changes to SD screens, login, or admin screens.
- No changes to fetch/action logic, payload mapping, or auto-refresh behavior.
