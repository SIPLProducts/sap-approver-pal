# Fix and republish PO Release “No POs Found” handling

## Verified current state

- The current PO Release page already opens a message dialog and clears rows whenever `fetchPoGet` returns an error.
- The current `fetchPoGet` implementation checks `STATUS` and `MSGTXT` only directly on the top-level SAP object. It does not detect those fields when the middleware/SAP wraps them inside `data`, `GET`, another object, or an array item.
- The project already has a shared deep, case-insensitive SAP lookup helper in `src/lib/mm/sap-message.ts`, but PO Release is not using it.
- The service worker has no fetch/cache handler, so it is not serving an old application bundle.
- Both public URLs currently serve the same deployment assets. The unauthenticated HTML does not preload the protected PO Release route chunk, so inspecting the homepage alone cannot prove the route behavior.

## Changes

1. Update only the PO Execute response parsing to find `STATUS` case-insensitively at any nested level, including array-wrapped responses.
2. When the detected status is `FALSE`, extract the exact nested `MSGTXT` value, return it as the error, and add no rows from that response.
3. Preserve the existing popup, table clearing, filters, Release/Reject workflows, and all other PO logic unchanged.
4. Add a focused regression test for top-level and nested/array-wrapped `STATUS: "FALSE"` responses so this cannot silently regress.
5. Run the focused test and production build verification, then run the security check and publish the verified build.
6. Confirm both the Lovable URL and custom domain resolve to the new deployment; then re-test after one hard refresh.

## Technical scope

- Reuse the existing deep SAP-response helper rather than duplicating parsing logic.
- Expected source changes: PO Release server parsing plus one focused test file only.
- No database, SAP API configuration, UI design, or unrelated business logic changes.
