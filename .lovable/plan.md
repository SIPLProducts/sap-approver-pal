Remove REL 2 and Status 2 columns from the Contract Approvals table.

Change
- `src/routes/_authenticated/sd.contract.tsx` line 396

from:
```tsx
columns={buildDynamicColumns(rows, { exclude: ["rel_1", "status_1"] })}
```

to:
```tsx
columns={buildDynamicColumns(rows, { exclude: ["rel_1", "status_1", "rel_2", "status_2"] })}
```

This hides the release-code and status columns for the second approval level across Pending, Accepted, and Rejected views on the Contract Approvals page while keeping the data fields intact for SAP submission and reports.

Verification: run `tsgo` typecheck and confirm the two columns no longer render in the Contract Approvals table preview.