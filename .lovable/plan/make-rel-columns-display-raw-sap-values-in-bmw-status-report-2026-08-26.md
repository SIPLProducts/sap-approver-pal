Make REL columns display raw SAP values in BMW Status Report

Current state
- `src/routes/_authenticated/sd.bmw-status.tsx` renders results with `buildDynamicColumns(rows)`.
- `src/lib/sd/dynamic-columns.tsx` auto-formats any 8-digit string (e.g. `20260325`) as a date.
- The `FORCE_TEXT_KEYS` set only contains lowercase `rel_1` … `rel_8`, but the SAP response uses uppercase `REL_1` … `REL_8`, so they are currently being converted to dates.

Change to make
- Update `src/lib/sd/dynamic-columns.tsx` so any column key starting with `REL` (case-insensitive) is treated as plain text and bypasses the date formatter.
- Keep all existing column-building, numeric, and alignment logic unchanged.

Verification
- Run the TypeScript type check / build to confirm no regressions.
- The BMW Status Report Sales Order view will show REL values exactly as returned by SAP.