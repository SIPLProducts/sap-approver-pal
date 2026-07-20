## Goal
Show human-friendly column headers in the PR Release results table, mapped from the SAP field keys returned by `PR_Release_Multiple_Fetch_API`.

## Change

**File:** `src/routes/_authenticated/mm.pr-release.tsx`

- Add a `COLUMN_LABELS: Record<string, string>` constant mapping each SAP key to its display label (all 85 entries from the request, e.g. `PREQ_NO → "PR Number"`, `PREQ_ITEM → "PR Item"`, … `PUR_MAT_LONG → "Long Purchasing Material Number"`).
- In the `<TableHead>` render, replace `{key}` with `{COLUMN_LABELS[key] ?? key}` so any unmapped key gracefully falls back to the raw key.
- Keep dynamic column derivation (union of keys across rows), selection checkbox column, row keying, empty-cell `-` formatting, Release/Reject buttons, and all other behavior unchanged.

## Not changing
- `src/lib/mm/pr-release.functions.ts` — response shape is untouched; labeling is purely presentational.
- No other screen currently renders pending PR rows; the request's "detail view" doesn't exist yet, so this change is scoped to the PR Release results table.
