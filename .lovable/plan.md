# PR Release "TYPE: E" handling + remove pre-action confirmations

## 1. PR Release: treat `TYPE: "E"` as an error-only popup

Today the PR Release fetch only shows a message popup when SAP returns no rows or a transport error. If SAP replies with a payload that carries `TYPE: "E"` alongside data-looking fields, those fields can still land in the results table.

Change:
- In the PR Release fetch handler, after parsing the SAP response, check for a `TYPE` value of `E` (case-insensitive, searched the same deep way the existing helper finds `MESSAGE`/`MSGTXT`).
- When found: discard any rows from that response and set the error to the exact `MESSAGE` value returned by SAP (no prefixes, no extra wording).
- The existing screen logic already clears the table and opens the message popup whenever the fetch returns an error, so no change is needed in the PR Release table rendering.

Result: a `TYPE: "E"` response shows only the SAP `MESSAGE` text in the popup, and the results table stays empty.

## 2. Remove reminder/confirmation popups before Release / Reject / Save

Across the app, the "Are you sure…?" dialog shown *before* an action is removed, so the action fires immediately on click. Popups that report the SAP *result* after the action stay exactly as they are.

Screens where the pre-action confirmation is dropped:
- MM: PR Release, PO Release, MIGO Release, Material Reservation, Gate Pass, Gate Process (save), ZNFA Release
- SD: Price, Contract, Sales Order, Service Certificate / SC-SO
- Approval detail (Reject / Send back)

Left untouched (destructive admin/data deletions, where a confirmation is a safety net rather than a reminder):
- Admin → Users (delete user)
- Admin → SAP API (delete config)
- Notifications (clear all)

## Technical notes

- `src/lib/mm/pr-release.functions.ts`: add the `TYPE === "E"` branch in the per-plant loop, using `findFirstDeep` / `extractSapMessage` from `src/lib/mm/sap-message.ts`; skip pushing rows and set `firstError` to the exact message.
- Action screens: remove the `await confirm({...})` guard blocks and the now-unused `confirm` binding / `confirmDialog` render and `useConfirm` import where nothing else uses them. All mutation calls, payload building, result dialogs, toasts and refresh logic remain byte-identical.
- No database, RLS, or server-payload changes.
