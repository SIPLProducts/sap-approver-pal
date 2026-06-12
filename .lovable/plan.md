## Goal
On the Contract Approvals screen, when **Status = Pending**, the table's **Reason** column becomes an editable text input. Reason is **mandatory** for every selected row before Accept or Reject can be submitted to SAP. The entered reason is saved into the row payload and sent to SAP (`REASON` field, which the server function already maps).

## Changes — single file: `src/routes/_authenticated/sd.contract.tsx`

1. **Per-row reason state**
   - Add `const [reasons, setReasons] = useState<Map<string, string>>(new Map())`.
   - Helper `setReasonFor(k, value)` to update one row.
   - Clear `reasons` on Reset, on new fetch (`onSuccess`), and after a successful decision submission (alongside `setSelected(new Set())`).

2. **Reason cell rendering (line 410)**
   - If `status === "pending"`: render an `<Input>` bound to `reasons.get(k) ?? ""`, `maxLength={50}`, placeholder `"Required"`, with red border when the row is selected and the reason is empty/whitespace (`aria-invalid`).
   - Otherwise (Accepted / Rejected tabs): keep the current read-only `{r.reason ?? "—"}` display.

3. **Mandatory validation in `decide(action)` (line 170)**
   - Build `selectedRows` and attach reason: `{ ...r, reason: (reasons.get(k) ?? "").trim() }`.
   - If any selected row's trimmed reason is empty → `toast.error("Reason is required for all selected rows")` and abort (do not call the mutation).
   - Otherwise submit as today. Server already forwards `reason` → SAP `REASON`.

4. **Button affordance**
   - Disable Accept/Reject when `selected.size > 0` and any selected row's reason is empty (in addition to existing `canAct` check), so the user sees why submission is blocked. Keep the toast as a safety net.

## Out of scope
- No backend / server-function / DB changes (the `reason` field is already part of the row schema and SAP payload mapping).
- No change to Accepted/Rejected tabs' display.
- No new dependencies.