## MIGO Release — optional year + SweetAlert-style post response

### Changes to `src/routes/_authenticated/mm.migo-release.tsx`

1. **Make Material Document Year optional**
   - Remove the "Material Document Year is required" toast/guard in `execute()`.
   - Remove the same guard in `check()` (only Material Document Number stays mandatory).
   - Keep the input field itself (no layout change), just no validation.

2. **Replace the Post result Dialog with a SweetAlert-style popup**
   - Add `sweetalert2` dependency (lightweight, standard for this pattern).
   - On `postMutation.onSuccess`, call `Swal.fire({ icon: res.ok ? 'success' : 'error', title: res.ok ? 'Success' : 'Failed', text: res.message, confirmButtonColor: res.ok ? '#16a34a' : '#dc2626' })`.
   - Show ONLY `res.message` as the body text. No `TYPE`, `MAT_DOC`, `DOC_YEAR`, `MESSAGE` labels, no raw JSON viewer.
   - Remove the existing `<Dialog>` block, `postResult` state, and related setters.
   - Keep the existing toast calls as-is (they already show only `res.message`).
   - Keep post-success behavior: re-run Get Details and clear selection.

### Out of scope
- No changes to `postMigo` server function, payload, or `MIGO_POST_API` wiring.
- No changes to fetch/check flows, table, header, or custom fields cards.
- No changes to other screens.
