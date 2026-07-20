## Add editable Remarks column to PR Release table

File: `src/routes/_authenticated/mm.pr-release.tsx`

### Changes

1. Add `REMARKS: "Remarks"` to the `COLUMN_LABELS` map.
2. Add local state to track per-row remarks edits:
   ```ts
   const [remarks, setRemarks] = useState<Record<string, string>>({});
   ```
   Reset it alongside `setRows`/`setSelected` in `onSuccess` and `reset()`.
3. Ensure `REMARKS` appears in the dynamic `columns` list even if the API omits it — after building `columns` from row keys, append `"REMARKS"` if not present, so the column always renders.
4. In the table body, render the `REMARKS` cell as an `<Input>` (same styling as the Gate Pass Remarks input — `h-8 text-xs`) bound to `remarks[k] ?? String(r.REMARKS ?? "")`, updating `remarks` state on change. All other cells continue to use the existing read-only string formatting.
5. No changes to fetch logic, business rules, Release/Reject buttons, selection, or the header row.

### Notes

- Remarks values remain client-side only for now (consistent with current Release/Reject buttons that just toast). No payload/API changes.
