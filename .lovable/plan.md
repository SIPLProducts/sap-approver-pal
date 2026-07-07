## Objective
Add four new columns to the Contract Approval Reports table: `REL_1`, `STATUS_1`, `REL_2`, `STATUS_2` (release codes and statuses from SAP `DATA[]`).

## Changes

### 1. `src/lib/sd/contract-approval.functions.ts`
- Extend `ContractRow` type with `rel_1`, `status_1`, `rel_2`, `status_2` (all `string | null`).
- In `mapRow()`, add `pick(raw, "REL_1")`, `pick(raw, "STATUS_1")`, `pick(raw, "REL_2")`, `pick(raw, "STATUS_2")`.
- Extend `ContractRowSchema` and `toSapContractRow()` with the same four fields so approve/reject round-trips the values back to SAP intact.

### 2. `src/routes/_authenticated/sd.contract-reports.tsx`
- Add four columns to the `CloudscapeApprovalTable` `columns` array:
  - `Rel. Code 1` → `r.rel_1`
  - `Status 1` → `r.status_1`
  - `Rel. Code 2` → `r.rel_2`
  - `Status 2` → `r.status_2`
- Place them at the end of the column list (after `company_code`), each falling back to `"—"` when null.

## Out of Scope
- No changes to the source Contract Approvals screen (`sd.contract.tsx`) or other report pages.
- No changes to filters, layout, or approve/reject flow beyond schema pass-through.
