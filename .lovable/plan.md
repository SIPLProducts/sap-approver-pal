## MIGO Release — STCK TYPE as dropdown

### Behavior
- In the Items table on `src/routes/_authenticated/mm.migo-release.tsx`, render the `STCK_TYPE` column (matched case-insensitively; also accept `STCKTYPE`) as an editable `<Select>` dropdown instead of plain text.
- Options (value shown in table = code, label shown to user = code + description):
  - `1` — "1 Unrestricted"
  - `2` — "2 Quality Inspection"
  - `3` — "3 Blocked"
- Selected value is stored in the same `edits` map used by STGE_LOC/checkboxes, so it flows into the existing Save payload without changes to save logic.
- If the SAP row's incoming value doesn't match `1|2|3`, keep it as-is in the underlying state but show it in the dropdown as the current selection (falls back to blank display if unmapped).
- Column position, header label, and all other columns/behavior remain unchanged.

### Implementation notes (technical)
- Add a small `isStckTypeKey(k)` helper next to `isEditableTextKey` / `isCheckboxKey`.
- In the `columns` `useMemo`, add a branch before the default cell renderer that returns a shadcn `<Select>` (already used elsewhere, e.g. ZNFA Rating) bound to `cur?.[key]`, calling `updateCell(k, key, value)` on change.
- Constant `STCK_TYPE_OPTIONS = [{ value: "1", label: "1 Unrestricted" }, { value: "2", label: "2 Quality Inspection" }, { value: "3", label: "3 Blocked" }]`.
- No changes to `src/lib/mm/migo-release.functions.ts`, header card, Custom Fields card, or Check/Get Details logic.

### Out of scope
- No API/payload changes; the existing Save already sends the merged edited row.
- No changes to other MM screens.