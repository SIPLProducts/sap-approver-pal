## MIGO Release — post-success reset + column reorder

### Changes to `src/routes/_authenticated/mm.migo-release.tsx`

1. **Reset screen after successful Post**
   - In `postMutation.onSuccess`, when `res.ok` is true, replace the current "re-run Get Details + clear selection" behavior with a full reset equivalent to the `reset()` function: clear `matDocNo`, `matDocYear`, `header`, `rows`, `edits`, `selected`, and `customFields`.
   - Keep the SweetAlert success popup and toast unchanged.
   - Failure path unchanged.

2. **Reorder Items table columns**
   - In the `columns` useMemo, after placing `LINE_ID` keys first, ensure `ENTRY_QNT` appears immediately after `MATERIAL`.
   - Build ordering: `[...lineIdKeys, "MATERIAL" (if present), "ENTRY_QNT" (if present), ...remaining keys in original order excluding those already placed]`. Case-insensitive match, preserve original key casing.

### Out of scope
- No changes to server functions, payloads, or APIs.
- No changes to other screens or table component.
