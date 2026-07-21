## Problem

In the Gate Pass screen, the editable checkboxes inside the results table (HOD Approval, HOD Rejection, Store Approval) don't toggle when clicked.

## Root cause

`CloudscapeApprovalTable` renders each cell with `c.cell(r)`, passing the raw row object — it does not attach a `__key` property to the row. In `mm.gate-pass.tsx`, `updateRowField` computes the target key as `(item as any).__key ?? rowKey(item, -1)`. Because `__key` is undefined and `-1` is not any row's actual index, the resulting key never matches `rowKey(r, i)` for any `i` in `setRows(...)`, so no row is ever updated and the checkbox appears frozen.

The row-selection checkbox in the leftmost column works because that flow goes through the table's own `toggleRow(k, checked)` using the correct index-based key.

## Fix

Change `updateRowField` in `src/routes/_authenticated/mm.gate-pass.tsx` to match the target row by object reference instead of by computed key:

```ts
function updateRowField(item: DataRow, key: string, value: any) {
  setRows((prev) => prev.map((r) => (r === item ? { ...r, [key]: value } : r)));
}
```

The row reference passed into `c.cell(item)` is the same object stored in the `rows` state array (the table wraps it in `{ r, i, k }` but passes `r` back), so reference equality is reliable and avoids the mismatched-index bug.

No changes to `CloudscapeApprovalTable`, the API, or any other screen.

## Verification

- Open Gate Pass, execute a fetch, click HOD Approval / HOD Rejection / Store Approval checkboxes on rows and confirm they toggle.
- Confirm row-selection checkboxes (leftmost column) still work.
- Confirm Save still sends only selected rows with the edited values.
