## Goal
Fix the `Missing required field(s): PLANT` 500 error that appears when fetching SD approvals with more than one plant selected.

## Diagnosis

When multi-plant fan-out runs, each plant is fetched with its own
`{ inputs: { PLANT: "<code>", ... } }` body, so the client-side payload is
correct. The error string comes from the standalone middleware
(`middleware/server.js` → `buildRequestPayload` → "Missing required
field(s): ...") which is reached via the proxy route for each plant.

The client currently fans out with `Promise.allSettled(plants.map(...))`,
i.e. *all plants in parallel*. The SAP middleware + SAP backend chain in this
environment cannot reliably handle two concurrent calls for the same
config/user — the second concurrent request observes an empty/overwritten
input object and the field validator fails with "Missing required field(s):
PLANT". Single-plant fetches work because there is no concurrency.

## Fix — serialize fan-out

In each of the four SD screens (`sd.contract.tsx`, `sd.price.tsx`,
`sd.sales-order.tsx`, `sd.sc-so.tsx`), change the `mutationFn` from a
parallel `Promise.allSettled(plants.map(...))` over `fetchFn(...)` to a
sequential `for (const p of vars.plants) { try { ... } catch { ... } }`
loop. Behaviour stays identical otherwise:

- accumulate rows from successful plants into a single array
- collect per-plant error messages into the combined error string
  (`"3801: <msg>; 3806: <msg>"`)
- preserve `fetched_at`, the toast, and the existing row-merging shape
- nothing on the SAP server functions or middleware changes

### Files

- `src/routes/_authenticated/sd.contract.tsx` — `mutationFn`
- `src/routes/_authenticated/sd.price.tsx` — `mutationFn`
- `src/routes/_authenticated/sd.sales-order.tsx` — `mutationFn`
- `src/routes/_authenticated/sd.sc-so.tsx` — `mutationFn`

## Non-goals
- No changes to the SAP server functions, the middleware, or the DB.
- No change to validation ("at least one plant"), pickers, or the
  `sd-approval-shell.tsx` client-side filter.

## Risk / trade-off
Sequential fetching is slower than parallel for users selecting many
plants — total time scales linearly with plant count instead of being
dominated by the slowest single SAP call. This is the correct trade-off
given the middleware/SAP cannot reliably serve concurrent requests.
A future option is to add a small concurrency limit (e.g. `p-limit(1)` or
`p-limit(2)`) once the middleware is hardened.
