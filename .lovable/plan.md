## Plan: Material Reservation UI Adjustments

Scope: presentation-only changes to `src/routes/_authenticated/mm.material-reservation.tsx`. No backend/server function or business logic changes.

### 1. Keep the search card visible after fetch
- Remove the `!hasResults` / `hasResults` conditional wrappers around the SELECTION SCREEN card.
- Always render the search card (Document Number, HOD Approve, User ID, Execute, Reset) — whether or not results have loaded.
- Remove the "Back to Search" `headerExtras` button on the items table (no longer needed since the search card stays on screen).
- HEADER card and Items table render only when there are results (`header !== null || rows.length > 0`), populated from the API response as they already are.

### 2. Add row-selection checkbox column in the Items table
- Reuse the existing `CloudscapeApprovalTable` selection support (used by Contract Approvals) by enabling `showSelect`.
- Add local state: `selected: Set<string>` and pass `selectedKeys={selected}` / `onSelectionChange={setSelected}` — this renders the built-in checkbox as the first column.
- No accept/reject actions are wired; `onAccept` / `onReject` remain unset. The Save button (below) is the only action.
- Reset clears `selected` in addition to existing state.

### 3. Save button between Header card and Items table
- Insert a right-aligned toolbar `<div className="flex justify-end">` containing a `<Button>Save</Button>` between the Header `<Card>` and the `<CloudscapeApprovalTable>`.
- The button is enabled when `selected.size > 0`; on click it currently only shows a toast placeholder (`toast.info("Save clicked")`) — no server call, since the user explicitly asked not to change existing logic and no save endpoint is defined yet.
- The button uses the standard shadcn `Button` styling (matches the app's other primary actions).

### 4. Verification
- Run the project build to confirm no TypeScript errors.
- Manually verify in preview: search card persists after Execute, header populates, checkbox appears as first column, Save sits right-aligned between header and table.

### Files touched
- `src/routes/_authenticated/mm.material-reservation.tsx` (only)
