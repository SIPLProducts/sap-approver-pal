## Goal
In the Create User dialog, replace the SAP-driven Role dropdown with one that lists **Custom Roles** scoped to the selected Plants, displayed as `PlantCode - RoleName`.

## Scope
Only `CreateUserDialog` in `src/routes/_authenticated/admin.users.tsx`. No backend, schema, or other-screen changes.

## Changes

1. **Drop SAP role fetch in the dialog**
   - Remove `useServerFn(listRolesForPlants)`, the `rolesQuery` `useQuery`, and the related error/toast `useEffect` block.
   - Keep `listRolesForPlants` import only if still used elsewhere in the file (it isn't — also remove the import).

2. **Load custom roles for selected plants from the DB**
   - Add a `useQuery` keyed on `["custom-roles-for-plants", sortedPlants]`, enabled when `sortedPlants.length > 0`.
   - Query:
     ```ts
     supabase
       .from("custom_roles")
       .select("id, name, is_active, tenants:tenant_id(code)")
       .eq("is_active", true)
       .in("tenants.code", sortedPlants)   // filter via FK join
     ```
     Fallback if PostgREST filter on joined column is awkward: fetch tenant ids for selected plant codes first (`tenants` table → `id, code`), then `custom_roles.in("tenant_id", ids)`.
   - Map rows to options: `{ value: "<plantCode>::<roleName>", label: "<plantCode> - <roleName>", role: roleName, plant: plantCode }`. Using a composite value keeps per-plant uniqueness when the same role name exists under multiple plants.

3. **Update Role field rendering**
   - Replace the existing `RoleMultiSelect` props to accept the new option objects (or adapt by passing the `label` array for display and tracking selection as composite values internally, then deduping to plain role names on submit).
   - Placeholder logic:
     - No plants selected → "— Select plants first —"
     - Loading → "Loading roles…"
     - No results → "No custom roles for selected plants"
   - On plant change, drop any selected role whose composite value is no longer in the option list (mirrors current effect).

4. **Submit payload**
   - `createUserViaSap` still receives `roles: string[]` of role names. Derive it by mapping selected composite values → unique role names (`Array.from(new Set(selected.map(v => v.split("::")[1])))`).
   - Plants payload unchanged.

5. **RoleMultiSelect**
   - If it currently expects `string[]` options, extend it to accept `{ value, label }[]` (preferred) — keep its API backward-compatible by allowing either. Only the Create User dialog uses the new shape; other callers (if any) remain unaffected.

## Out of scope
- Role Permissions tab, Custom Roles tab, Users tab role chips.
- Any SAP middleware or server function changes.
- DB migrations (custom_roles already has `tenant_id`; tenants already has `code`).

## Technical notes
- `PlantMultiSelect` returns plant codes (strings), matching `tenants.code`.
- Selected role values stored as `"<plantCode>::<roleName>"` for UI uniqueness; SAP receives deduped role names only.
- The "no roles" hint text replaces the current "SAP returned no roles…" message.
