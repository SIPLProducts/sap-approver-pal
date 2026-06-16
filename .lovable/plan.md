# Fix: Accepted / Rejected goes to 404 on Sales Order Approvals

## Problem

In the Sales Order Approvals screen, clicking the **Accepted** or **Rejected** radio shows the global 404 page even though the toast "Loaded 1 record from SAP" confirms the API succeeded.

Root cause: `onStatusChange` (and `reset`) call

```ts
navigate({ search: (prev) => ({ ...prev, status: s }) })
```

In the Lovable preview the URL carries extra params (`__lovable_sha`, `__lovable_load_id`). That `navigate` call, combined with `useNavigate({ from: "/_authenticated/sd/sales-order" })`, ends up writing the route-ID path (`/_authenticated/sd/sales-order`) into the address bar instead of the public URL `/sd/sales-order`. The route-ID path matches no route → 404. The API call had already fired before the navigation, so its success toast still appears.

The user-visible effect: the table never gets a chance to render the rows returned by the API.

## Fix (frontend only — `src/routes/_authenticated/sd.sales-order.tsx`)

1. **Stop pushing `status` into the URL.** It's already kept in component state (`statusState`) and is used purely for UI. Removing the navigate eliminates the broken URL rewrite and the 404.
   - Remove the `navigate({ search: ... })` call from `onStatusChange`.
   - Remove the `navigate({ search: ... })` call from `reset`.
   - Remove the now-unused `useNavigate` import + `navigate` binding.
   - Keep reading the initial value from `Route.useSearch()` so deep links like `?status=accepted` still preselect the tab on first load.

2. **Keep the existing behavior on tab switch** (already in place — verify after edit):
   - Clear `rows`, `selected`, `reasons`, `lastFetchedAt`.
   - If `plant` is filled, immediately call `fetchFor(s)` (which sends `R_PEND`/`R_ACCP`/`R_REJ` matching the chosen tab).
   - If `plant` is empty, toast "Enter Plant and click Execute".

3. **No backend / server-function changes.** `fetchSalesOrderApprovals` already maps `status → R_PEND/R_ACCP/R_REJ` correctly and returns rows; the table rendering code is unchanged.

## Verification

- On `/sd/sales-order`, enter Plant `3806`, click **Execute** → Pending rows load.
- Click **Accepted** → URL stays at `/sd/sales-order`, table clears, API is called with `R_ACCP=X`, returned rows render in the same table.
- Click **Rejected** → same behavior with `R_REJ=X`.
- No 404 page should appear.

## Notes

- Deep-linking via `?status=accepted` is still honored on first render (the initial state seeds from `Route.useSearch()`); only the *write-back* to the URL on tab change is removed.
- If we later want shareable `?status=` URLs, we can re-add it as `navigate({ to: "/sd/sales-order", search: { status: s }, replace: true })` (explicit `to`, no relative `from`).
