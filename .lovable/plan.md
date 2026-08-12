# PR Release: exact SAP messages in popups

Bring PR Release message handling in line with PO Release, without changing any of the existing selection, table, release or reject behaviour.

## 1. Execute — show only the exact SAP MESSAGE

Today, when the fetch fails, the screen shows a toast with a wrapped string such as `SAP returned 500 Internal Server Error: {...}`, and in some cases partially fetched rows stay in the table.

Change:
- The fetch server function extracts the SAP-provided message text (`MESSAGE`, falling back to `MSGTXT`) from the response body — including when the response carries no data rows — and returns it verbatim as the failure message. The generic wrapper text is only used if SAP supplies no message at all.
- On the screen, a failed or empty result opens the same response dialog used for Release/Reject, showing only that exact message text. No toast for this case.
- The table is cleared (rows, selection, remarks) so no failed/partial data is displayed.

## 2. Release / Reject — exact MSGTXT in a PO-style popup

Today each PR result is shown as a stack of sonner toasts.

Change:
- Replace the toasts with the same dialog design PO Release uses: title (`PR Release Response` / `PR Reject Response`), a two-column table (`PR Number` / `Message`), success in green and failure in red, a collapsible "Raw response" block per PR, and a Close button in the footer.
- The message shown is the exact SAP `MSGTXT` for that item; the existing error string is used only when SAP returned none.
- The PR action server function also returns the raw SAP payload per item so the raw block has real content (same as PO).

Everything else stays as-is: released/rejected rows are still removed from the table, the list is still refreshed after a successful action, and the confirm dialogs before Release/Reject remain.

## Technical notes

- `src/lib/mm/pr-release.functions.ts`
  - `fetchPrReleaseMultiple`: pull `MESSAGE`/`MSGTXT` out of the parsed SAP body (deep, case-insensitive lookup, same helper style already used in `processPrAction`) and return it as `error`; keep the sync-log writes unchanged.
  - `processPrAction` / `PrReleaseResult`: add optional `MSGTXT` and `response` (raw SAP JSON for that item) fields; no change to `ok` / status evaluation logic.
- `src/routes/_authenticated/mm.pr-release.tsx`
  - Add a `responseDialog` state plus the `Dialog` block copied from `mm.po-release.tsx`, keyed on PR number/item.
  - `mutation.onSuccess`: on `res.error` or zero rows, clear state and open the dialog with just that message.
  - `releaseMutation.onSuccess` / `rejectMutation.onSuccess`: build dialog rows instead of firing toasts; keep row-removal and refetch logic.
