# Make Remarks (Reason) optional in SD Approvals

Applies to Contract Approvals, Service Certificate & SO Approvals, and Sales Order Approvals.

## Behaviour after the change
- Remarks/Reason can be left blank on selected rows.
- Approve/Reject buttons stay enabled based only on having at least one selected pending row.
- No "Reason is required for all selected rows" error, and no red invalid highlight on the Reason input.
- Blank remarks are submitted as an empty value; everything else (payloads, fetch, filters, table, refresh) is unchanged.

## Technical changes

`src/routes/_authenticated/sd.contract.tsx`, `sd.sc-so.tsx`, `sd.sales-order.tsx`:
- Drop the `missingReason` gate from `canAct` (keep `showSelect && selected.size > 0`) and remove the now-unused `missingReason` memo.
- Remove the `Reason is required for all selected rows` guard in the submit handler; still send `reason` as the trimmed value (empty string when blank).
- Pass `reasonInvalid={() => false}` (or omit the prop) so blank remarks no longer render as invalid.

No changes to `src/lib/sd/*.functions.ts`, the approval table component, or fetch payloads.
