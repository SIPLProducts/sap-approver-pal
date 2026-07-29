## Problem

In the MIGO Release screen, the Post response popup currently shows only the `MESSAGE` text. The user wants the success popup to also display the returned `MAT_DOC` and `DOC_YEAR` values from the SAP response.

## Current state

- `src/lib/mm/migo-release.functions.ts` already extracts and returns `mat_doc` and `doc_year` from the SAP response (case-insensitive), so no server-side change is needed.
- `src/routes/_authenticated/mm.migo-release.tsx` currently calls `Swal.fire({ text: res.message })` in the `postMutation.onSuccess` handler and ignores the document fields.

## Plan

1. Update the `postMutation.onSuccess` handler in `src/routes/_authenticated/mm.migo-release.tsx` to build a formatted message that includes:
   - `res.message`
   - `Material Document: <res.mat_doc>` (when `res.mat_doc` is present)
   - `Document Year: <res.doc_year>` (when `res.doc_year` is present and non-zero)
2. Keep the existing SweetAlert icon/title/colour logic unchanged (`success` when `res.ok`, `error` otherwise).
3. Preserve the existing screen reset behaviour after a successful post.
4. Verify the change builds and the popup text is rendered correctly.

## Scope

- Only the MIGO Release Post response popup text changes.
- No server function, API payload, or business logic changes.
- No changes to other screens or tables.