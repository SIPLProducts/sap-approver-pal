## Problem

The `submitContractDecision` Zod validator declares `contract_item` and `upper_slab` as `z.string().nullable().optional()`, but the table rows pass these fields through as **numbers** (e.g. `contract_item: 10`, `upper_slab: 2`). Validation fails before the SAP call is made, producing the `invalid_type` error in the browser console on Accept/Reject.

## Fix

In `src/lib/sd/contract-approval.functions.ts`, change the two offending fields in `ContractRowSchema` to accept either string or number (matching how other numeric-ish fields like `qty`, `net_value`, `fixed_rate` are already declared):

```ts
contract_item: z.union([z.string(), z.number()]).nullable().optional(),
...
upper_slab: z.union([z.string(), z.number()]).nullable().optional(),
```

The existing `toSapContractRow` mapper already runs every value through `s(...)` which coerces to string, so no other code changes are needed. The SAP payload shape stays identical.

## Files touched

- `src/lib/sd/contract-approval.functions.ts` — 2-line schema change inside `ContractRowSchema`.

No DB/migration/UI changes.
