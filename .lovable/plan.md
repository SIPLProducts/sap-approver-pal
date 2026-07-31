## Goal

In User Management → Create/Edit User, the Plant field's F4 list should come from the **GET_USER_PLANT** SAP API config (verified present and active in SAP API Settings) instead of the currently used **Get_Plant** config. All SD screens keep using Get_Plant unchanged.

## What I'll change

1. **New server function** (`src/lib/sap/plant.functions.ts`): add `getUserPlantConfig`, mirroring the existing `getPlantConfig` but looking up the config named `GET_USER_PLANT` and returning `plantField: "WERKS"`.

2. **Plant multi-select** (`src/components/sap/plant-multi-select.tsx`): add an opt-in prop (e.g. `source="user-plant"`, default stays the current behaviour) that makes the component resolve the GET_USER_PLANT config and call it with an empty payload `{}` — that config has no request fields defined in SAP API Settings, so nothing extra is sent.

3. **Response parsing** (`src/components/sap/plant-select.tsx` → `extractPlantOptions`): add `NAME1` to the description key list so rows like `{ "WERKS": "0001", "NAME1": "Werk 0001" }` render as `0001 - Werk 0001`. `WERKS` is already recognised as a code key.

4. **User dialog** (`src/routes/_authenticated/admin.users.tsx`): pass the new prop on the `PlantMultiSelect` inside the Create/Edit User dialog only. Existing selection, validation, and role-loading behaviour stay identical.

No changes to business logic, payload building for user create/update, or any other screen.

## Note

GET_USER_PLANT currently has no request fields configured, so the call goes out with an empty body. If it actually needs the logged-in user ID (e.g. `{ "BNAME": "<user>" }`), tell me and I'll include it.
