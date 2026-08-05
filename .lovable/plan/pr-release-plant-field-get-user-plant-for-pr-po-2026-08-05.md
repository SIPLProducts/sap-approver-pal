# PR Release: Plant field + GET_USER_PLANT for PR & PO

## What changes

1. **PR Release screen** gets a Plant field in the selection screen, styled and positioned exactly like the one on PO Release (first field, before Release Group / Release Code). It is required, pre-filled from the plants chosen in the top bar, and the Release Group / Release Code F4 lists keep filtering by the selected plants.

2. **Execute payload for PR Release** becomes:
   ```json
   { "PLANT": "3702", "RELGROUP": "P2", "RELCODE": "F1" }
   ```
   When more than one plant is selected, one call per plant is made and the rows are combined into a single result table (same pattern PO Release already uses). Nothing else about fetch, table, release, or reject behaviour changes.

3. **Plant F4 source** for both PR Release and PO Release comes from the `GET_USER_PLANT` API configured in SAP API Settings, instead of the current default plant API on PO Release.

## Technical details

- `src/lib/mm/pr-release.functions.ts` — `fetchPrReleaseMultiple`: add `plants: string[]` to the input validator; loop over plants and build `inputs = { PLANT, RELGROUP, RELCODE }` per plant; accumulate rows and keep the existing proxy/basic-auth, sync-log, and error-return behaviour. Release/reject functions untouched.
- `src/routes/_authenticated/mm.pr-release.tsx` — add `plants` state seeded from `activePlants` (with the same `useEffect` sync as PO Release), render `<PlantMultiSelect source="user-plant" />` in the grid, switch `releaseKeysFor(..., "pr", plants)`, validate plant selection on Execute, clear it on Reset, and pass `plants` in the mutation input.
- `src/routes/_authenticated/mm.po-release.tsx` — pass `source="user-plant"` to `PlantMultiSelect`.
- No change needed to `PlantMultiSelect` / `getUserPlantConfig`; the `user-plant` source already exists.
