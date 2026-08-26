# Gate Pass — results table checkboxes + per-mode field locking

## 1. New checkbox columns

In the results table, SCM Head, PH Approval, PH Rejection and Return Status change from read-only text to editable checkboxes (same `X` / blank convention already used by HOD Approval, HOD Rejection and Store Approval). Column order, labels and widths stay as they are.

## 2. Mutually exclusive pairs (per row)

- Ticking HOD Approval clears HOD Rejection, and vice versa.
- Ticking PH Approval clears PH Rejection, and vice versa.
- Ticking an already-ticked box clears it (no selection).

## 3. Field locking based on the selection screen

The mode locked in at the moment Execute succeeds decides which row fields stay editable. Disabled fields render greyed out and non-interactive; their values are still shown and still sent on Save unchanged.

| Selected on the selection screen | Editable in the table | Disabled |
| --- | --- | --- |
| HOD Approval | HOD Approval, HOD Rejection, HOD Remarks | Issued Qty, Store Approval, Justification, SCM Head, PH Approval, PH Rejection, Return Status, Remarks |
| Store Approval | Issued Qty, Justification, Store Approval | HOD Approval, HOD Rejection, HOD Remarks, SCM Head, PH Approval, PH Rejection, Return Status, Remarks, Returned Qty |
| SCM Head | SCM Head | HOD Approval, HOD Rejection, HOD Remarks, Issued Qty, Store Approval, Justification, PH Approval, PH Rejection, Return Status, Remarks |
| Plant Head | PH Approval, PH Rejection, Remarks | HOD Approval, HOD Rejection, HOD Remarks, Issued Qty, Store Approval, Justification, SCM Head, Return Status |
| Return Receipt | Return Status, Returned Qty, Remarks | HOD Approval, HOD Rejection, HOD Remarks, Issued Qty, Store Approval, Justification, SCM Head, PH Approval, PH Rejection |
| Nothing selected | everything editable (current behaviour) | — |

Issued Qty and Returned Qty become editable inputs so they can participate in this locking (today both are read-only text). Under any mode where they are listed as disabled they look and behave exactly like the other locked fields.

## Technical notes

- Only `src/routes/_authenticated/mm.gate-pass.tsx` changes. No server function, payload, SAP config or database change.
- Add `executedFlag` state set from `flag` in the fetch mutation's `onSuccess`; cleared by `reset()`. The `columns` memo depends on it.
- `editCheckbox` and `editInput` helpers gain a `disabled` argument driven by a `lockedFor(mode)` set; add `editCheckboxExclusive(key, partnerKey)` that clears the partner in the same `setRows` update.
- Save logic, selection, dialogs and the F4 dropdown are untouched.
