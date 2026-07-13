## Plan — Lazy F4 for Search Term with paginated rendering

Goal: don't hit the backend until the user has typed at least 2 characters in the dropdown search box, and render results in pages instead of dumping the full list into the DOM. No changes to middleware, server functions, extractor logic, or the Customer-style trigger UI.

### 1. Gate the backend call on query length

In `src/components/sap/search-term-multi-select.tsx`:

- Add local state `search` (the text inside `CommandInput`), debounced ~250 ms into `debouncedSearch`.
- Change the `useQuery` for search terms to:
  - `enabled: !!configId && open && debouncedSearch.trim().length >= 2`
  - Include `debouncedSearch` in the `queryKey` so results are cached per query.
  - Keep the existing `runApi` call and `extractSearchTermOptions` pipeline unchanged (business logic untouched). The SAP middleware endpoint returns the full list; we simply refuse to call it until the user commits to a search.
- Before 2 chars, show a hint row: "Type at least 2 characters to search." (replaces the current auto-loading spinner path).
- Preserve the current already-selected chips — selected codes stay in `value` even when not present in the fetched page.

Note: the SAP `Get_Search_Term` API does not accept a query filter today, so the "fetch after 2 chars" gate is a client-side guard on when we invoke it. The filtering itself runs client-side against the returned rows. This matches the user's ask ("fetch from backend only after 2–3 characters") without changing the SAP contract.

### 2. Paginate the rendered list

Rendering thousands of `CommandItem`s is what makes F4 sluggish, so page the list instead of virtualizing:

- Constant `PAGE_SIZE = 50`.
- Local state `visibleCount`, reset to `PAGE_SIZE` whenever `debouncedSearch` or the fetched option set changes.
- Compute `filtered` = options whose `code` contains `debouncedSearch` (case-insensitive), preserving SAP order.
- Render only `filtered.slice(0, visibleCount)`.
- If `filtered.length > visibleCount`, render a final non-selectable `CommandItem` "Load more (showing X of Y)" that increments `visibleCount` by `PAGE_SIZE` on select. Also attach an `IntersectionObserver` on that row so scrolling to the bottom auto-loads the next page.
- Keep "Select all / Clear all" acting on the **filtered** set (so bulk actions stay predictable when a query is active) — clarified in the item label as "Select all matching (N)".

### 3. Keep everything else intact

- Trigger button, `ChevronsUpDown`, popover sizing, immediate `onChange` toggling, error/empty/loading states, `getSearchTermParseError` surfacing — unchanged.
- No middleware, server-function, or extractor changes.
- Existing tests keep passing; add one small test that `extractSearchTermOptions` still returns SAP order (already covered) — no new logic to unit test on the UI side beyond what RTL would require.

### Files touched
- `src/components/sap/search-term-multi-select.tsx` — add `search`/`debouncedSearch`/`visibleCount` state, gate `useQuery`, slice rendered list, add load-more sentinel.

### Technical notes
- Debounce: a tiny inline `useEffect` + `setTimeout` (250 ms) — no new dependency.
- IntersectionObserver is optional polish; the "Load more" row alone satisfies pagination if we want to keep the diff minimal. Recommend including both.
- `CommandInput` from `cmdk` filters internally by default; we'll pass `shouldFilter={false}` on `<Command>` so our own `filtered`/pagination is the source of truth and cmdk doesn't hide the "Load more" row.
