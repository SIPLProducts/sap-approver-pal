# Populate Users table from SAP `Create_User_Display_Table`

Replace the local Supabase profile feed in the Users tab with rows returned by the SAP `Create_User_Display_Table` API (configured in SAP API Settings). Send an empty payload `{}` and render whatever the response returns. Edit/Delete actions remain but operate on the SAP `USER` id.

## Backend: new server function

In `src/lib/admin/user-mgmt.functions.ts` add `listUsersViaSap`:

- Admin-gated (`assertAdmin`).
- Resolve config via `findSapConfigId(["USER_DISPLAY_TABLE", "Create_User_Display_Table", "CreateUserDisplayTable", "User Display Table", "USER_LIST"])`.
- Call `invokeViaMiddleware(cfgId, {})`.
- Treat response permissively: accept top-level array, or any of `DATA / data / ITEMS / RESULTS / USERS / USER_LIST / TABLE` (first array child of the response), mirroring `extractPlantOptions` traversal.
- Normalize each row to a flat DTO:
  ```ts
  {
    user: string,            // USER / EMPNO / SAP_USER_ID
    first_name: string,      // FIRST_NAME / FNAME
    last_name: string,       // LAST_NAME / LNAME
    full_name: string,       // NAME / FULL_NAME, else `${first} ${last}`
    email: string,           // EMAIL / SMTP_ADDR
    contact: string,         // CONTACT / MOBILE / TEL_NUMBER
    status: string,          // STATUS (ACTIVE/INACTIVE)
    plants: string[],        // PLANTS[].WERKS or PLANT/WERKS scalar
    roles: string[],         // ROLES[].ROLE or ROLE scalar
    raw: <original row>,     // for future column needs
  }
  ```
- Honor SAP error envelope (`STATUS = ERROR/FAIL`) and throw with `MESSAGE`.
- Write a best-effort `admin_audit_log` row (`user.sap_user_list`) with row count.
- Return `{ users: NormalizedRow[] }`.

No DB schema changes.

## Frontend: `UsersTab` in `src/routes/_authenticated/admin.users.tsx`

- Add a TanStack Query `["admin-sap-users"]` calling `listUsersViaSap` via `useServerFn`. Make `refreshAll()` invalidate this key when on the Users tab.
- Replace the `profiles` source driving the table:
  - Rows = `usersQuery.data?.users ?? []`.
  - Columns map: `Name → full_name`, `Employee ID → user`, `Email → email`, `Plants → plants[]` (badges), `Role → roles[]` (first as pill, rest as `+N`).
  - Keep search filter against `full_name + email + user`.
  - Keep the plant filter dropdown; filter rows by `plants.includes(plantFilter)`.
- KPI tiles: derive from SAP rows where possible — `Total = users.length`, `Admins = users.filter(u => u.roles.includes("ADMIN")).length`, `Role Heads = roles intersect HEAD_ROLE_KEYS` (uppercased), `Unassigned = users.filter(u => u.roles.length === 0).length`. Drop the now-unused Supabase `profiles / roles / customLinks / tenantLinks` queries inside this tab.
- Actions (per row, keyed by SAP `USER`):
  - Edit (role toggle popover) calls `setBuiltInRole` with `user_id` = SAP `USER` string. Note: existing `setBuiltInRole` validates `z.string().uuid()`; relax that single validator to `z.string().min(1).max(60)` so the SAP user id is accepted. No other behavior change.
  - Delete calls `deleteUser` similarly; same validator relaxation on `user_id`.
  - "you" badge / self-disable check removed (no reliable mapping from `auth.uid()` to SAP `USER`).
- Loading and error states: show a single skeleton row while loading and an error row with the SAP message + Retry button.

## Empty / misconfig states

- If the API config is missing, server fn throws — surface in the error row with a hint to add an active config named `Create_User_Display_Table` in SAP API Settings.
- If SAP returns zero rows, keep the existing "No users match the filters." empty row.

## Technical notes

- Field-pick helper: reuse the existing `pickField` for case-insensitive lookups; add a small `pickArray` that returns the first array under a candidate key list.
- All field names checked case-insensitively and trimmed; status normalized to uppercase for display.
- No changes to `CustomRolesTab`, `PermissionsTab`, `ApprovalMatrixTab`, middleware, or `runSapApi`.
