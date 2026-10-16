# Transportation (90%) Exception Billing — hide Change/Delete for New Record results

## Request
When Execute runs with `check: "X"` (New Record ticked), the results table should show only the Save button — no Change or Delete.

## Current behavior
`headerExtras` already hides Save unless `checkFlag === "X"`, but Change and Delete always render.

## Change
In `src/routes/_authenticated/imw.transportation-exception-billing.tsx` (results table `headerExtras`):

- Render the Change button (green) only when `checkFlag !== "X"`.
- Render the Delete button (red) only when `checkFlag !== "X"`.

Result:
- Normal Execute (check empty) → Change + Delete shown (Save hidden), as today.
- New Record Execute (check "X") → only Save shown.

## Not changing
Save/Change handlers, `submit()` payloads, `90%_Save_API` / `90%_Change_API` integration, table columns, row editors, selection, refresh logic, and all other screens.

## Verification
- Typecheck: `bunx tsgo --noEmit -p tsconfig.json`.
- Playwright check in preview: Execute with New Record ticked shows only Save; without it shows Change + Delete (SAP call-dependent — verify button rendering logic via code inspection if SAP is slow).
