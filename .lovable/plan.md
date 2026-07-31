## Goal

The plant filter above the Users table (User & Role Management → Users tab) currently loads its F4 list from the `Get_Plant` config. Switch it to the `GET_USER_PLANT` config (same source already used by the Create/Edit User dialog's Plant field), reading `WERKS` as the code and `NAME1` as the description.

## Current state

- `src/routes/_authenticated/admin.users.tsx` (line ~400) renders `<PlantSelect ... restrictToActive={false} />` for `plantFilter`.
- `PlantSelect` (`src/components/sap/plant-select.tsx`) hardcodes `getPlantConfig` (the `Get_Plant` config, field `VKORG`).
- `getUserPlantConfig` already exists in `src/lib/sap/plant.functions.ts` and returns the `GET_USER_PLANT` config id with field `WERKS`.
- `PlantMultiSelect` already supports a `source: "default" | "user-plant"` prop; `PlantSelect` does not.

## Changes

1. **`src/components/sap/plant-select.tsx`**
   - Add an optional `source?: "default" | "user-plant"` prop (default `"default"`), mirroring `PlantMultiSelect`.
   - Resolve the config via `getUserPlantConfig` when `source === "user-plant"`, else `getPlantConfig`; default plant field `WERKS` vs `VKORG` accordingly.
   - Include `source` in the config react-query key so the two lists cache separately.
   - Make the empty-state message generic ("No plants returned. Check SAP API Settings.") instead of naming `Get_Plant`.

2. **`src/routes/_authenticated/admin.users.tsx`**
   - Pass `source="user-plant"` to the `PlantSelect` used for the Users-table plant filter.

No changes to filtering logic, payload shape (`inputs: {}`, as configured in SAP API Settings), or any other screen — all other `PlantSelect` usages keep the existing `Get_Plant` behaviour.

## Verification

Open User & Role Management → Users tab, open the plant filter dropdown, confirm it lists `WERKS - NAME1` values from GET_USER_PLANT and that selecting one still filters the user rows.
