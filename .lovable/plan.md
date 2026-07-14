## Plan — F4 Search Term: show 50 on open, filter after 2+ chars, paginate

Goal: on popover open, fetch once and show the first 50 rows. When the user types ≥2 characters, filter the fetched dataset and show paginated matches. No changes to middleware, server functions, extractor, or Customer-style trigger UI.

### Context / constraint

SAP's `Get_Search_Term` endpoint does not accept a query filter — it returns the full list. So "fetch from backend after 2–3 chars" is not literally possible against this endpoint. We keep a single backend call (cached for 5 min) and do the filtering client-side, which matches the user-visible behavior they want (fast dropdown, only relevant matches shown, no giant DOM).

### Changes in `src/components/sap/search-term-multi-select.tsx`

1. Fetch gate
   - `stQuery.enabled = !!configId && open` (fetch as soon as the popover opens, not gated on query length).
   - Keep the existing `runApi` + `extractSearchTermOptions` pipeline untouched.
   - Keep `staleTime: 5 min` so re-opening the popover does not re-hit SAP.

2. Initial view (no query)
   - Constant `PAGE_SIZE = 50`.
   - When `debouncedSearch.length < 2`, `filtered = options` (full list, SAP order) and we render `filtered.slice(0, visibleCount)` — so the first paint shows only the first 50 rows.
   - Show a subtle hint above the list: "Showing first 50 — type 2+ characters to filter."

3. Filtered view (≥2 chars)
   - `debouncedSearch` (250 ms debounce of `search`).
   - `filtered = options.filter(o => o.code.toLowerCase().includes(q))`, preserving SAP order.
   - Render `filtered.slice(0, visibleCount)`.

4. Pagination (both modes)
   - `visibleCount` starts at `PAGE_SIZE`, resets whenever `debouncedSearch` or `options` change.
   - If `filtered.length > visibleCount`, render a non-selectable "Load more (showing X of Y)" `CommandItem` that bumps `visibleCount` by `PAGE_SIZE` on select.
   - Attach `IntersectionObserver` to that row so scrolling to the bottom auto-loads the next page.
   - Keep `<Command shouldFilter={false}>` so our slice is the source of truth.

5. Bulk actions
   - "Select all / Clear all" operates on the current `filtered` set (label: `Select all matching (N)` / `Clear all matching (N)`), so behavior is predictable in both modes.

6. Untouched
   - Trigger button, `ChevronsUpDown`, popover sizing, immediate `onChange` toggling, error/empty/loading states, `getSearchTermParseError` surfacing, extractor, server functions, middleware.

### Files touched
- `src/components/sap/search-term-multi-select.tsx` — flip `enabled` back to fetch-on-open, change the pre-query branch to render the first page of the full list instead of a hint-only state, keep debounce + pagination + IntersectionObserver.

### Technical notes
- The single-fetch-then-client-filter approach is the only way to honor "fetch matching results from the backend" against an SAP endpoint that has no filter parameter; if you later expose a server-side filter (e.g. a `Q` input on the API config), we can switch `queryKey` to include `debouncedSearch` and re-enable fetch-on-type without touching the UI.
- No new dependencies; debounce is an inline `setTimeout` in `useEffect`.
