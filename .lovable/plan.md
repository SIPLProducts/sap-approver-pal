## Problem
In the Gate Pass results table, the in-cell checkboxes (HOD Approval, HOD Rejection, Store Approval) and text inputs (HOD Remarks, Justification, Remarks) don't respond to clicks — state never updates.

## Root cause
`updateRowField` in `src/routes/_authenticated/mm.gate-pass.tsx` locates the target row with `prev.indexOf(item)`. But `CloudscapeApprovalTable` wraps each row into a new object (`{ ...row, __key }`) before passing it to `cell`, so the reference no longer exists in `rows` and `indexOf` returns `-1`. The setter early-returns and nothing changes.

## Fix
Update `updateRowField` in `src/routes/_authenticated/mm.gate-pass.tsx` to match rows by their computed `rowKey` instead of object identity:

```ts
function updateRowField(item: DataRow, key: string, value: any) {
  const targetKey = (item as any).__key ?? rowKey(item, -1);
  setRows((prev) =>
    prev.map((r, i) => (rowKey(r, i) === targetKey ? { ...r, [key]: value } : r)),
  );
}
```

No other file, styling, API, or business-logic changes.

## Verification
- Fetch Gate Pass data.
- Toggle HOD Approval / HOD Rejection / Store Approval checkboxes in the table — they now check/uncheck.
- Edit HOD Remarks / Justification / Remarks inputs — values persist.
- Row-level selection (leftmost column) and Save flow continue to work unchanged.