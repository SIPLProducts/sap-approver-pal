## Goal

Add four SAP-provided columns to the Sales Order Approval Reports table: `REL_1`, `STATUS_1`, `REL_2`, `STATUS_2`. Table shape and Execute behavior stay unchanged.

## Changes

### 1. `src/lib/sd/sales-order-approval.functions.ts`
- Extend `SalesOrderRow` with four new nullable string fields: `rel_1`, `status_1`, `rel_2`, `status_2`.
- In `mapRow`, add `pick(raw, "REL_1")`, `pick(raw, "STATUS_1")`, `pick(raw, "REL_2")`, `pick(raw, "STATUS_2")` (case-insensitive picker already handles variants).
- Extend the `SalesOrderRowSchema` (used by the decision submit) with the same four optional/nullable fields so approve/reject payloads still validate.
- In `toSapSalesOrderRow` (submit mapper), pass through `REL_1`, `STATUS_1`, `REL_2`, `STATUS_2` from the row (empty string when missing).

### 2. `src/routes/_authenticated/sd.sales-order-reports.tsx`
- Append four columns to the existing columns array (after `tax_value`), each right-aligned or default, showing `r.rel_1`, `r.status_1`, `r.rel_2`, `r.status_2` with `— ` fallback:
  - `Rel. Code 1`
  - `Status 1`
  - `Rel. Code 2`
  - `Status 2`

## Out of scope

- No changes to selection screen, filters, Execute logic, or backend payload keys sent to SAP.
- No changes to the interactive Sales Order screen (`sd.sales-order.tsx`) — only Reports.
- No styling / layout changes beyond adding four columns.

## Verification

- Load `/sd/sales-order-reports`, click Execute → the four new columns appear at the end of the table and render values from `DATA[].REL_1/STATUS_1/REL_2/STATUS_2`.
- Empty/missing fields render `—`.
- Build + typecheck pass.
