## Objective
Remove the Status and Approval Type radio button filters from the Contract Approvals Reports, Service Certificate & SO Approvals Reports, and Sales Order Approvals Reports pages. When Execute is clicked, each report should return records of all statuses (and both approval types for SC-SO) combined in a single list.

## Affected Files

### Report Route Files (UI removal)
- `src/routes/_authenticated/sd.contract-reports.tsx`
- `src/routes/_authenticated/sd.sc-so-reports.tsx`
- `src/routes/_authenticated/sd.sales-order-reports.tsx`

### Server Functions (backend "all" support)
- `src/lib/sd/contract-approval.functions.ts`
- `src/lib/sd/sc-so-approval.functions.ts`
- `src/lib/sd/sales-order-approval.functions.ts`

## Changes

### 1. Server Functions — add "all" option
For `fetchContractApprovals`, `fetchSalesOrderApprovals`, and `fetchScSoApprovals`:
- Extend the `status` enum to include `"all"` (e.g. `z.enum(["pending", "accepted", "rejected", "all"])`).
- In the handler, when `data.status === "all"`, set `R_PEND`, `R_ACCP`, and `R_REJ` all to `"X"` so SAP returns pending, accepted, and rejected records together.
- For `fetchScSoApprovals`, also extend `approval_type` to include `"all"`. When `data.approval_type === "all"`, set both `service` and `Sales` flags to `"X"`.

### 2. Report Pages — remove radio buttons and default to "all"
For each report page:
- Remove the entire `RadioGroup` JSX block for Status (all three pages).
- On `sd.sc-so-reports.tsx`, also remove the Approval Type `RadioGroup` block.
- Remove related `useState` for `status` (and `approvalType` on SC-SO), plus any `Label` / `RadioGroupItem` imports that become unused.
- Hard-code `status: "all"` (and `approval_type: "all"` on SC-SO) in the `execute()` mutation payload.
- Update the `CloudscapeApprovalTable` title to remove the status suffix (e.g. change `title={`Contract Approval Reports — ${status}`}` to just `"Contract Approval Reports"`).
- Adjust the `reset()` function to no longer reset `status` / `approvalType`.

### 3. Validation
- Run `bun run build` to confirm TypeScript compiles and route tree generates cleanly.
- Optionally use Playwright to verify the radio buttons are no longer rendered on each report page.

## Out of Scope
- No changes to the source approval screens (`sd.contract.tsx`, `sd.sc-so.tsx`, `sd.sales-order.tsx`) — those keep their existing Status / Approval Type radio buttons.
- No new columns or table layout changes.