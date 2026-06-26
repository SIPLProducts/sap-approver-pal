## Goal
Change the Create User dialog Role dropdown to list **every Custom Role** (not filtered by the role's own tenant), shown once per selected Plant as `PlantCode - RoleName`.

## Behavior
- If no plants selected → "— Select plants first —" (unchanged).
- If plants selected → options = cartesian product of (selected plant codes × all active custom roles), labeled `<PlantCode> - <RoleName>`.
  Example: plants `[3801, 3802]` and custom roles `[ADMIN, USER]` →
  - `3801 - ADMIN`
  - `3801 - USER`
  - `3802 - ADMIN`
  - `3802 - USER`
- Selecting/deselecting plants regenerates options; previously selected role values not in the new option set are dropped.

## Changes (only `CreateUserDialog` in `src/routes/_authenticated/admin.users.tsx`)

1. **Custom-roles query** — replace the plant-filtered query with a plant-agnostic one:
   ```ts
   queryKey: ["custom-roles-all"]
   queryFn: () => supabase.from("custom_roles").select("id, name").eq("is_active", true).order("name")
   ```
   Always enabled; cache with `staleTime: 60_000`.

2. **Compute roleOptions** in a `useMemo` from `sortedPlants` × `customRoles`:
   ```ts
   plants.flatMap(p => roles.map(r => ({ value: `${p}::${r.name}`, label: `${p} - ${r.name}` })))
   ```
   Empty array when no plants selected.

3. **Stale-selection cleanup** — keep the existing `useEffect` that drops selected role values no longer in `roleOptions`; just key it on `roleOptions` instead of `rolesQuery.data`.

4. **Submit payload** — unchanged: dedupe role names from composite values before sending to `createUserViaSap`.

5. **Placeholder / empty-state text**:
   - Loading custom roles → "Loading roles…"
   - Plants selected, zero custom roles in system → "No custom roles configured."

## Out of scope
- `RoleMultiSelect` component shape (already accepts `{value,label}[]`).
- SAP server functions, Custom Roles tab, Role Permissions tab.
- DB schema.
