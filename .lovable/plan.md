## Price Approvals — header cleanup, auto employee id, table styling, pagination, checkbox shape, sidebar toggle

### 1. `src/routes/_authenticated/sd.price.tsx`

**Header** — replace the current header block with just the H1:
- Delete the subtitle paragraph ("BMW VK11 condition approvals fetched live from SAP…").
- Delete the two badges (`ZBMW_VK11_APP`, `Single level`) and the flex row that holds them.
- Result: only `<h1>Price Approvals</h1>` remains at the top.

**Auto employee id (SAP USER_ID)**
- Remove the `USER_ID` `<Label>` + `<Input>` from the selection screen.
- Keep the `getMySapUserId` query and the `userId` state — but stop rendering it; keep it seeded from `userIdData.sap_user_id` and pass it silently to `fetchFn` / `submitPriceDecision`.
- Collapse the selection-screen grid from `[200px_220px_1fr_auto]` to `[240px_1fr_auto]` (Plant · spacer · action buttons).
- `reset()` keeps the auto-populated id.

**Table header background**
- Change the `<thead>` class from `bg-muted/50` to `bg-sidebar text-sidebar-foreground` so the header row matches the app sidebar color (uses existing `--sidebar` token — no hardcoded color).
- Adjust cell text color to `text-sidebar-foreground` for contrast.

**Row checkbox — square**
- Pass `className="rounded-none"` to both the header select-all and per-row `<Checkbox>` so they render as a sharp square instead of the current `rounded-sm` shape.

**Pagination (client-side)**
- New state: `pageSize: number | 'ALL'` (default `10`) and `page: number` (default `1`).
- Derive `pagedVisible` = `pageSize === 'ALL' ? indexed : indexed.slice((page-1)*pageSize, page*pageSize)`.
- Render pagination footer inside the output card, below the table:
  - Left: "Page size" `<Select>` with options `10, 20, 25, 50, 100, ALL`.
  - Right: `Previous` / `Next` buttons + `Page X of Y` label (using existing `@/components/ui/pagination` primitives, styled compact).
- Reset `page` to `1` when `rows`, `pageSize`, or filters change.
- Use `pagedVisible` for table body rendering; keep `visible` (all rows) for select-all math so "select all" still selects the full result set (or scope to current page — I'll scope to current page for a predictable UX; document in code comment).

### 2. `src/routes/_authenticated.tsx` — sidebar collapse toggle

The shell uses a custom `<aside>` with a mobile `open` state. Add a desktop collapse:
- New state `collapsed: boolean` (persist to `localStorage['app.sidebarCollapsed']`).
- `<aside>` width: `w-64` when expanded, `w-16` when collapsed. Hide text labels / section headings / user card details when `collapsed` (keep icons + tooltips via `title`).
- In the existing top bar, add a `<Button variant="ghost" size="icon">` with the `PanelLeft` (lucide) icon that toggles `collapsed` on desktop (`hidden lg:inline-flex`) and toggles the existing mobile `open` on small screens (`lg:hidden`). Place it as the first item in the top bar so it is always visible.
- No change to routing, permissions, or nav item list.

### 3. Notes / non-goals

- No change to `price-approval.functions.ts` — server payload continues to receive `user_id` from `getMySapUserId`.
- No change to any other screen's checkbox shape (only the Price Approvals table rows are re-styled).
- No change to `Checkbox` primitive — override done locally via `className`.
- Table header color reuses the existing `--sidebar` token, so light/dark themes stay consistent.
