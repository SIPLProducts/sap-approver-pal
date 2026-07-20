Simplify the PR Release screen (`src/routes/_authenticated/mm.pr-release.tsx`) based on the request:

1. Remove the Single Level / Multiple Level radio buttons entirely.
   - Remove the `RadioGroup` and `RadioGroupItem` import.
   - Delete the `level` state and the radio group JSX.
2. Always use the existing `PR_Release_Multiple_Fetch_API`.
   - The `fetchPrReleaseMultiple` call remains unchanged.
   - Remove the `level === "single"` guard in `execute()` so the API always runs.
3. Move the Release / Reject action buttons so they sit between the input fields and the output table.
   - Add a button bar directly below the selection card (after Release Group / Release Code / Execute).
   - Buttons remain enabled only when rows are selected and show the same toast behavior.
   - Remove the duplicate button bar from the bottom of the results card.
4. Keep all existing behavior unchanged:
   - Release Group / Release Code inputs and validation.
   - Execute / Reset buttons.
   - Dynamic column rendering, column labels, row selection, empty-cell formatting.
   - Results card visibility still depends on `mutation.isSuccess || rows.length > 0`.

Files changed:
- `src/routes/_authenticated/mm.pr-release.tsx`