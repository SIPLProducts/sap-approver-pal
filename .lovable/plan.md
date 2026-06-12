# Price Approval — Accept/Reject polish

Scope is UI + wiring only on `src/routes/_authenticated/sd.price.tsx`. The `submitPriceDecision` server fn (already calls the `Price_Approve_Reject` config from SAP API Settings via middleware/direct mode) stays as-is.

## Changes

### 1. Accept button → green
Replace the default primary Accept `<Button>` with an explicit green style using semantic-safe inline classes:
```
className="bg-green-600 hover:bg-green-700 text-white"
```
Reject button stays `variant="destructive"` (red). Keep spinner + disabled states intact.

### 2. Verify Accept/Reject actually fires the API
`decide()` already calls `decisionMutation.mutate({ action, rows: selectedRows })` which invokes the `submitPriceDecision` server fn. Confirming the guard order:
- Buttons are disabled unless `status === "pending"` AND `selected.size > 0` AND not pending.
- If the user is on the Accepted/Rejected tab, buttons are disabled by design — that's why "nothing happens". No code change needed, but add a subtle tooltip/title hint: `title="Switch to Pending tab and select rows"` on disabled state so it's obvious.

### 3. Header checkbox sync (thead ↔ tbody)
Current logic already derives header state from row selection:
- `allChecked = visible.length > 0 && visible.every(({k}) => selected.has(k))`
- `someChecked = visible.some(...) && !allChecked`
- Header `<Checkbox checked={allChecked ? true : someChecked ? "indeterminate" : false} />`

This already satisfies: select all rows → header checks; uncheck any row → header unchecks (drops to indeterminate or false). No logic change required — will verify in preview after the color change. If the user is seeing stale header state, it's because `selected` is a `Set` and React may not re-render; will switch to `new Set()` cloning on every toggle (already done in `toggleOne`/`toggleAll`) — confirmed correct.

No changes to: server function, middleware, DB, or other routes.

## Files
- `src/routes/_authenticated/sd.price.tsx` — Accept button className, optional disabled-title hint.
