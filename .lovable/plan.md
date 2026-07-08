The previous exclude list used `release_code_1` / `approval_status`, but Contract and Sales Order rows actually expose these fields as `rel_1` / `status_1`. Because the keys do not match, the columns are still rendered.

Changes
-------
1. `src/routes/_authenticated/sd.contract.tsx`
   - Update the `buildDynamicColumns` `exclude` array from `["release_code_1", "approval_status"]` to `["rel_1", "status_1"]` so the REL 1 and Status 1 columns disappear from the Contract Approvals table.

2. `src/routes/_authenticated/sd.sales-order.tsx`
   - Apply the same key fix to the `exclude` array so the same columns are hidden on the Sales Order Approvals screen.

Reports screens remain unchanged; these columns will still be visible there.

Verification
------------
- Run `tsgo` typecheck after the edits.
- Confirm in the preview that Contract Approvals and Sales Order Approvals no longer show REL 1 / Status 1.