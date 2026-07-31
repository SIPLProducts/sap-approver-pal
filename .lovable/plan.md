## Goal

On PO Release, the Plant dropdown should list exactly the plants selected in the top bar.

## Why it's empty today

`PlantMultiSelect` builds its option list from the `Get_Plant` SAP API response and then *intersects* it with the top-bar `activePlants`. If `Get_Plant` returns codes that don't match the login profile's plant codes (or the config is missing/errors), the intersection is empty — so nothing shows, even though the top bar has plants selected. The top-bar plants themselves already come from the login response (`useActiveContext().plants` / `activePlants`) and need no API call.

## Change

1. `src/components/sap/plant-multi-select.tsx`
   - Add an opt-in source `source="active-context"` (existing `"default"` / `"user-plant"` behaviour untouched).
   - In that mode, skip both SAP queries entirely and build options from `useActiveContext()`: one entry per `activePlants` code, using the matching `plants[].name` as the description.
   - Keep everything else identical: search box, Select-all/Clear-all, checkbox toggling, pruning of selections outside the allowed set, and the comma-separated `Input` fallback is simply not needed in this mode.

2. `src/routes/_authenticated/mm.po-release.tsx`
   - Pass `source="active-context"` to the `<PlantMultiSelect>` in the selection screen. No other logic changes — local `plants` state, the existing sync effect against `activePlants`, `releaseKeysFor(...)`, Execute/Reset, and the release/reject flows stay as-is.

## Scope notes

- PR Release and all other screens using `PlantMultiSelect` keep their current API-driven behaviour; only PO Release opts in. Say the word if you want PR Release switched too.
- No backend, SQL, or server-function changes.
