## Scope
File: `src/routes/_authenticated/sd.contract.tsx`

## Changes

1. **Remove header clutter**
   - Delete the subtitle line "BMW contract approvals fetched live from SAP via Contract_Approval_Fetch."
   - Delete the two badges: `ZBMW_CONTRACT_APP` and `2 levels`.
   - Keep the `Contract Approvals` H1.

2. **Sidebar background on table header**
   - Replace `<thead className="bg-muted/50 border-b sticky top-0 z-10">` with `bg-sidebar text-sidebar-foreground` so the header uses the semantic sidebar token (matches app sidebar). Keep `sticky top-0 z-20 border-b`.
   - Update `th` cells to remove any conflicting muted colors (they inherit foreground from thead).

3. **Sticky column filter row**
   - Add a second header row directly under the column titles containing per-column text `Input`s (small `h-7`) for the main visible columns: Customer, Customer Name, Contract No, Item, Material, Sales Org, Co. Code. Numeric/date columns get empty `<th>` placeholders to preserve alignment; Select and # columns also empty.
   - Wrap the row in `<tr>` with `sticky top-[36px] z-10 bg-sidebar/95 backdrop-blur` so filters also stick while data scrolls.
   - Filter state: `const [filters, setFilters] = useState<Record<string, string>>({})`. A `filteredIndexed` memo applies case-insensitive `includes` per field before pagination. All existing `indexed`/`allChecked`/`toggleAll` logic switches to operate on the paginated slice's keys (select-all toggles current page's visible rows).

4. **Pagination (client-side)**
   - Add `pageSize = 25` and `page` state. Compute `pageCount = Math.max(1, Math.ceil(filteredIndexed.length / pageSize))`, `pageRows = filteredIndexed.slice((page-1)*pageSize, page*pageSize)`.
   - Reset `page` to 1 when `rows`, `status`, or `filters` change.
   - Below the table (inside the Card, outside the scroll container) render a footer bar with:
     - Left: "Showing X–Y of N" text.
     - Right: shadcn `Pagination` (`PaginationPrevious`, up to 5 numeric `PaginationLink`s with ellipsis, `PaginationNext`). Handlers call `setPage`.

5. **Scroll only the body**
   - Keep the scroll container `<div className="overflow-auto max-h-[60vh]">` — sticky `thead` (title + filter rows) inside it means only tbody scrolls, exactly as requested.
   - Ensure `<table>` keeps `w-full text-xs` and no `overflow` on parent Card interferes (Card already `overflow-hidden`; the pagination footer sits below the scroll div, both inside Card).

## Out of scope
- No changes to server functions, data shape, decision/approve/reject logic, or the ResultDialog.
- No changes to sidebar or global styles.

## Technical notes
- Semantic tokens only (`bg-sidebar`, `text-sidebar-foreground`, `border-sidebar-border` where needed) — no hardcoded colors.
- Row `key`s and `rowKey()` unchanged so selection/reason maps continue to work across pages.
- `allChecked` and `toggleAll` scoped to `pageRows` so select-all is per page (standard behavior with pagination).
