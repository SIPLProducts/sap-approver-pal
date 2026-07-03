## Scope

Apply the same treatment done for `sd.contract.tsx` to three additional screens:
- `src/routes/_authenticated/sd.sc-so.tsx` (Service Certificate & SO Approvals)
- `src/routes/_authenticated/sd.sales-order.tsx` (Sales Order Approvals)
- `src/routes/_authenticated/sd.bmw-status.tsx` (BMW Status Report)

## Changes (identical pattern per file)

1. **Header cleanup** — Keep only the H1 tab name. Remove:
   - `sd.sc-so.tsx`: subtitle "BMW Service Certificate / Sales Order PH approvals fetched live from SAP." + badges `ZBMW_SC_ISSUE_PH`, `Single level`.
   - `sd.sales-order.tsx`: subtitle "BMW sales order approvals fetched live from SAP via Sales_Approval_Fetch." + badges `ZBMW_SO_APP`, `Single level`.
   - `sd.bmw-status.tsx`: subtitle "Customer / Contract / Sales-wise BMW status report fetched live from SAP." + badges `BMW_STATUS`, `Read-only`.
   - Remove now-unused `Badge` import in each file.

2. **Sticky header with sidebar background**
   - Replace `<thead className="bg-muted/50 border-b sticky top-0 z-10">` with `bg-sidebar text-sidebar-foreground sticky top-0 z-20 border-b`.
   - For `sd.bmw-status.tsx` (which has a two-row header: group row + column row), apply `bg-sidebar text-sidebar-foreground` to `thead`; the group row stays at `top-0 z-20`, the column row stays sticky at `top-[height] z-20` (keep existing structure, only swap colors).
   - Remove muted color overrides on `th` cells that would conflict with the sidebar foreground.

3. **Client-side pagination (25 rows/page)**
   - Add `pageSize = 25` + `page` state. Compute `pageCount`, `pageRows = indexed.slice((page-1)*pageSize, page*pageSize)`. Reset `page` to 1 whenever `rows` (or `status`/`mode`) changes.
   - Table body renders `pageRows` instead of `indexed`/`rows`. Row `#` uses absolute index (`(page-1)*pageSize + i + 1`).
   - For sc-so and sales-order: `allChecked` / `toggleAll` scope switches to `pageRows` (per-page select-all — standard pagination behavior). Selection Map/Set keyed by `rowKey` is preserved across pages, so decision submit still gathers all selected rows across all pages.
   - Below the scroll container (inside the Card) add a footer bar:
     - Left: "Showing X–Y of N".
     - Right: reusable inline `PagerNav` (shadcn `Pagination` primitives, up to 5 numeric links with ellipsis, Prev/Next) — same component shape used in `sd.contract.tsx`.

4. **Scroll only the body** — Keep the existing `overflow-auto max-h-[60vh]` scroll container; sticky `thead` inside it means only tbody scrolls. Pagination footer sits outside the scroll div but inside the Card.

## Out of scope
- No changes to server functions, filter/selection screens, decision/approve/reject logic, ResultDialog, or column definitions.
- No per-column filter row (bmw-status has a huge dynamic schema; contract's filter row was the request there — user did not ask for filters on these three).
- No sidebar or global styles changes. Semantic tokens only.

## Technical notes
- Selection state (`selected` Set + `reasons` Map) is keyed by `rowKey(r, i)` — unchanged, so selections persist across page changes.
- `PagerNav` helper duplicated inline in each file (matches existing pattern from `sd.contract.tsx`); no shared component extracted to keep the change minimal and localized.
- All colors via semantic tokens (`bg-sidebar`, `text-sidebar-foreground`) — no hardcoded hex.
