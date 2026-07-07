## Goal

Change the three "Reports" screens so they request `status: "pending"` by default (instead of `"all"`), and add a working Approval Type control to the SC/SO Reports screen.

## Changes

### 1. `src/routes/_authenticated/sd.contract-reports.tsx`
- In the mutation `fetchFn` call, change `status: "all"` → `status: "pending"`.

### 2. `src/routes/_authenticated/sd.sales-order-reports.tsx`
- In the mutation `fetchFn` call, change `status: "all"` → `status: "pending"`.

### 3. `src/routes/_authenticated/sd.sc-so-reports.tsx`
- Change default backend `status` from `"all"` to `"pending"`.
- Add an `approvalType` state (`"service" | "sales"`, default `"service"`).
- Pass `approval_type: approvalType` to the backend instead of the hardcoded `"all"` (matches the shape used by `sd.sc-so.tsx`, which is the interactive screen this Reports view mirrors).
- Render an Approval Type radio group inside the Selection Screen card (below the existing filter grid, using the same pattern as `sd.sc-so.tsx`: `RadioGroup` + `RadioGroupItem` with options **Service Certificate Approvals** / **Sales Order Approvals**).
- Include `approvalType` in `reset()` (reset back to `"service"`).
- Re-fetch is triggered manually via the existing Execute button (no auto-fetch on change, keeping the Reports-screen behavior consistent with the other two report screens).

## Out of scope
- No changes to server functions (`*.functions.ts`), backend payload shape, columns, or the interactive approval screens.
- No new UI beyond the single Approval Type radio group on the SC/SO Reports screen.
