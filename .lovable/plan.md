# Plan: Populate Create User roles from SAP per selected plants

## Goal
In the **Create User** dialog (`admin.users.tsx`), remove the static `ALL_ROLES` dummy list from the Role picker. Instead, fetch roles from the SAP middleware based on the plants the admin has selected, merged as a **union** across plants. Before any plant is selected, the picker stays **enabled but empty**.

## Steps

### 1. Register SAP "Role List" endpoint
Admin saves a new config in **Admin → SAP API Settings** named `ROLE_LIST` (module `COMMON`, `http_method: POST`, auth via proxy). The server function resolves it by name at call time. If it's missing, the call surfaces a clear configuration error.

### 2. New server function `listRolesForPlants`
File: `src/lib/admin/user-mgmt.functions.ts`

- Input: `{ plants: string[] }` (WERKS list, non-empty)
- Payload sent to middleware (`ROLE_LIST` config):
  ```json
  { "ROLE_LIST": { "PLANTS": [{ "WERKS": "3801" }, { "WERKS": "3802" }] } }
  ```
- Calls `invokeViaMiddleware('ROLE_LIST', payload)` (same pattern as `createUserViaSap`).
- Normalises the SAP response to a flat, **deduplicated union** of role codes, e.g. `["ADMIN","APPROVER","VIEWER"]`. Tolerates the common SAP shapes (`ROLES: [{ROLE}]`, `T_ROLES`, top-level array) and uppercases each role.
- Returns `{ roles: string[] }`. On non-success or HTTP error, throws with the SAP `MESSAGE` so the dialog can toast it.

### 3. Wire the dialog
File: `src/routes/_authenticated/admin.users.tsx`

- Replace static `ALL_ROLES` usage inside `RoleMultiSelect` with a prop-driven `options: string[]` (and accept a `loading` flag + `disabledHint`).
- In `CreateUserDialog`:
  - Add `useQuery({ queryKey: ['sap-roles', plants], queryFn: () => listRolesForPlantsFn({ data: { plants } }), enabled: plants.length > 0, staleTime: 60_000 })`.
  - Pass `data?.roles ?? []` into `RoleMultiSelect`.
  - When `plants` changes, drop any currently-selected role that is no longer in the new options (`setRoles(prev => prev.filter(r => options.includes(r)))`).
  - When `plants.length === 0`: options is `[]`, picker stays enabled and shows the existing "— Select Roles —" placeholder (no extra hint, per the chosen behaviour).
  - While loading: show a small "Loading roles…" inside the popover; "Select all" reflects the fetched count, not 13 hard-coded roles.
- Keep submit validation: at least one role must be selected.

### 4. Keep `createUserViaSap` unchanged
The submit still sends the chosen roles as the cartesian (plant × role) `ROLES` array — that logic already matches the prior decision.

### 5. Cleanup
- `ALL_ROLES` / `ROLE_LABELS` stay in the file for other tabs (assignment menu, pill labels) — only the create dialog stops using them as a source.
- For unknown role codes returned by SAP (not in `ROLE_LABELS`), display the raw code as the label.

## Technical notes
- No DB schema changes.
- No new edge functions — uses existing `invokeViaMiddleware`.
- Response-shape normaliser is intentionally permissive; if SAP returns a single object, it's wrapped into an array before dedupe.
- Query is keyed by the sorted plants array so reordering doesn't cause refetches.

## Out of scope
- Changing the user list / table.
- Editing the SAP middleware code itself.
- Per-plant role assignment UI (still union; cartesian on submit).
