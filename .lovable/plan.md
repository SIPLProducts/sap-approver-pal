## Problem

In Material Reservation, the editable cells (HOD Approval, HOD Rejection, Remarks) read the row key from `(item as any).__key`, but `CloudscapeApprovalTable` passes the raw row object to `cell(item)` — it never attaches `__key`. So `k` is `undefined`, `updateRow` writes state under the key `"undefined"`, and every real row's state stays at the default `{ hodApproval: false, hodRejection: false, remarks: "" }`.

At save time, the payload builder looks up `rowStates.get(rowKey(r, i))` (the real key), finds nothing, and sends `HOD_APRROVAL: ""` and `HOD_REJECTION: ""` regardless of what the user clicked.

## Fix

In `src/routes/_authenticated/mm.material-reservation.tsx`, compute the row key inside each editable cell using the same `rowKey(r, i)` used elsewhere, instead of reading `__key` off the item.

In the `columns` `useMemo`, replace the three `const k = (item as any).__key as string;` lines (in the HOD Approval, HOD Rejection, and Remarks cell renderers) with:

```ts
const idx = rows.indexOf(item);
const k = rowKey(item, idx);
```

Add `rows` to the `useMemo` dependency array.

No other changes — save handler, fetch, selection, and business logic stay as-is. Row checkboxes for HOD Approval / HOD Rejection now update the real per-row state, so the outgoing Material_Save_API payload contains `HOD_APRROVAL: "X"` / `HOD_REJECTION: "X"` for the rows the user actually toggled.

## Verification

Execute Material Reservation, toggle HOD Approval on one row and HOD Rejection on another, select both rows, click Save, and confirm the outgoing payload sends the correct `HOD_APRROVAL` / `HOD_REJECTION` flags per row.