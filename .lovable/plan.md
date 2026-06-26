## Goal
Roles return successfully from SAP but the dropdown stays empty — the response parser isn't finding them, and any query error is being swallowed. Make the parser walk the full response, surface errors loudly, and fix a small React bug.

## Changes

### 1. Broaden the SAP response parser
File: `src/lib/admin/user-mgmt.functions.ts` (`listRolesForPlants` handler)

Today `visit()` only recurses into object keys matching `/ROLE/i`, so SAP shapes like `{ STATUS:"TRUE", DATA:[...] }`, `{ ET_OUTPUT:[...] }`, `{ T_OUTPUT:{ item:[...] } }`, or `{ OUTPUT:{ ROLES:{...} } }` come back empty.

Fix:
- Recurse into **every** object value (drop the `/ROLE/i` filter), but still skip `PLANTS`, `WERKS`, `STATUS`, `MESSAGE`, `NUMBER` (and a small denylist of metadata keys) to avoid grabbing plant codes.
- Extend the field detector to also pick up common SAP role-field aliases: `ROLE`, `AGR_NAME`, `ROLE_ID`, `ROLE_CODE`, `ROLE_NAME`, `Z_ROLE`, `ZROLE`.
- When the visitor hits a plain object that has a `WERKS` + a single other string field, treat that other string as the role value (handles `[{WERKS:"3801", AGR_NAME:"ADMIN"}]` shapes regardless of field name).
- Keep the dedupe + uppercase + sort.

Also log the raw SAP body (truncated) to `admin_audit_log` on every call (action `user.sap_role_list`) so we have a record of what the parser saw — useful for future SAP shape tweaks. Existing `assertAdmin` is not needed here (any signed-in admin user opening the dialog should be able to list roles), but require admin to keep parity with `createUserViaSap`.

### 2. Surface errors in the dialog
File: `src/routes/_authenticated/admin.users.tsx` (`CreateUserDialog`)

- When `rolesQuery.isError` toast the error message (once per error) so a SAP failure isn't silent.
- Replace the `useMemo(..., [rolesQuery.data])` side-effect (line 738) with `useEffect` — `useMemo` is not meant for `setState`, and React 18 may skip it.
- When `rolesQuery.data` arrives with `roles.length === 0`, show a small inline `text-destructive` hint under the Role field: "SAP returned no roles for the selected plants." (so the empty state is explicit instead of looking like a still-loading control).

### 3. No DB / migration changes
Parser broadening is enough; if SAP returns roles in any reasonable nested shape they'll now appear.

## Out of scope
- Changing the SAP `ROLE_LIST` request payload shape (still `{ ROLE_LIST: { PLANTS:[{WERKS}] } }`).
- Touching `createUserViaSap` or the submit cartesian.
- Per-plant role grouping (still union).

## After applying
Open Create User, pick a plant, and either:
- roles populate (fix worked), or
- an explicit toast / inline hint tells us exactly what SAP returned, which we can paste back to refine the parser further.