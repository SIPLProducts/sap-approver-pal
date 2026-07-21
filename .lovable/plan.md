## Changes

### 1. `src/routes/_authenticated/mm.gate-pass.tsx`
Reorder the selection-screen checkboxes so they appear in this order (after the Gate Pass Number field): HOD Approval → Store Approval → SCM Head → Plant Head → Return Receipt. Only the JSX order in the grid changes; state, labels, and payload keys stay identical.

### 2. `src/routes/_authenticated/mm.pr-release.tsx`
Add a search input above the results table that filters the displayed rows client-side.
- Add local `search` state.
- Compute `filteredRows` from `rows` by case-insensitive substring match across the visible/string fields of each row (e.g. `Object.values(row).some(v => String(v ?? "").toLowerCase().includes(q))`).
- Pass `filteredRows` to `CloudscapeApprovalTable` instead of `rows`. Keep selection keyed by the same `rowKey` so selecting a filtered row still works for Release/Reject.
- Show the row count based on `filteredRows.length` (e.g. `(${filteredRows.length}/${rows.length})`).
- Placement: right-aligned small `Input` (h-9, max-w-sm) directly above the table, with a Search icon.

## Out of scope
- No API, payload, or business-logic changes.
- No changes to Release/Reject behavior beyond operating on the same selection set.
- No changes to other screens.
