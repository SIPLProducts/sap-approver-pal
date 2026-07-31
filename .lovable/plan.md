## Goal
Make the Customer F4 dropdown (used by the BMW Status Report's "Customer From/To" fields) load in pages of 50 with infinite scroll, instead of rendering the entire SAP customer list at once. No UI or business-logic changes.

## Approach
`Customer_Fetch_API` returns the full list in a single SAP call (no server-side paging parameter), so the win comes from two things — the same pattern already proven in the Search Term multi-select:

1. **Deferred fetch** — only call SAP when the dropdown is actually opened (`enabled: !!configId && open`), instead of on page load. This removes the heavy call from the BMW report's initial render.
2. **Windowed rendering with infinite scroll** — keep only 50 rows mounted, and append the next 50 automatically as the user scrolls to the bottom of the list.

## Changes — `src/components/sap/customer-select.tsx`
- Add `PAGE_SIZE = 50`, `visibleCount` state, and a `loadMoreRef` sentinel.
- Gate the customers query on `open` so the SAP call happens on first open (result still cached 5 min per plant, so reopening is instant).
- Add a debounced (250 ms) search value driven by `CommandInput`, with `Command shouldFilter={false}`, and filter matching on customer code and name. This replaces cmdk's built-in filtering, which currently walks every row on each keystroke.
- Reset `visibleCount` to 50 whenever the search text or result set changes, and reset search + count when the popover closes.
- Render `filtered.slice(0, visibleCount)`; when more remain, render a "Load more (showing X of Y)" row that is both clickable and observed by an `IntersectionObserver` rooted on the cmdk list, so scrolling to it auto-appends the next page.
- Keep the existing trigger label, checkmark, loading/error/empty states, plain-input fallback when the config is missing, and the `onChange` contract exactly as-is.

## Not changed
`src/routes/_authenticated/sd.bmw-status.tsx`, `src/lib/sap/customer.functions.ts`, and the SAP middleware are untouched. Note the shared `CustomerSelect` is also used by the SD approval screens; they get the same speed-up with identical behavior.
