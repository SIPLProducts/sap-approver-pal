## Goal
Show every field returned by `PR_Release_Multiple_Fetch_API` in the PR Release results table, not just the 19 hardcoded columns.

## Change
**File:** `src/routes/_authenticated/mm.pr-release.tsx`

- Remove the hardcoded `COLUMNS` array.
- Derive columns dynamically from the response rows: union the keys across all rows (preserving first-seen order) so columns stay stable even if some rows omit a field.
  ```ts
  const columns = useMemo(() => {
    const keys: string[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      for (const k of Object.keys(r)) {
        if (!seen.has(k)) { seen.add(k); keys.push(k); }
      }
    }
    return keys;
  }, [rows]);
  ```
- Render `TableHead` and `TableCell` by mapping over `columns`. Use the raw key as the header label (matches SAP field names from the response).
- Keep existing formatting for empty values (`-`), the leading selection checkbox column, row keying (`PREQ_NO`-`PREQ_ITEM`-idx), Release/Reject buttons, and all other behavior unchanged.
- Update the empty-state `colSpan` to `columns.length + 1`.

## Not changing
- `src/lib/mm/pr-release.functions.ts` — server function already returns the full row objects unmodified.
- Payload, business logic, selection, or action-button behavior.
