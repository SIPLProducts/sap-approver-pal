## Remove Action tabs from Price Approval screen

Scope: `src/routes/_authenticated/sd.price.tsx` only. Contract and Sales Order screens are untouched.

### Changes

1. **Remove the Pending / Accepted / Rejected tab strip** (the `<Tabs>` block at the bottom of the Selection Screen card, lines ~264–275, plus its surrounding border-top wrapper).
2. **Show all fetched records** in the output table — drop the per-bucket filter. `visible` becomes the full `indexed` list.
3. **Keep Accept / Reject buttons** active whenever rows are selected (remove the `status === "pending"` gate). Once a row is decided, it's marked locally and stays in the table; users can re-decide if needed.
4. **Output header**: change `Output — {status}` to just `Output`. Per-row status (decided pending/accepted/rejected) remains tracked internally for the Accept/Reject submission flow but is no longer used to filter the view.
5. Remove the now-unused `status` URL search param, `setStatus`, `counts`, and the `Tabs/TabsList/TabsTrigger` imports.
6. Remove `validateSearch` and the `searchSchema` since the `status` query param is no longer needed.

No backend, server-function, or other-screen changes.