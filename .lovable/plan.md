### Goal
Make the Edit actions in the Users and Roles tables open the existing creation popups (Create User and Add New Role) pre-filled with the selected row's data. Change the popup titles to "Edit User" and "Edit Role". On Save, call the configured `Edit_User` and `Edit_Role` SAP APIs via middleware instead of creating new records.

### Why
The current Edit buttons are inconsistent:
- Users table Edit opens a small Popover that only toggles local roles.
- Roles table Edit opens a separate minimal inline dialog that only edits local name/description/status.

The user wants a unified experience where Edit reuses the full creation popup, pre-populated, and sends updates to SAP.

### Discovery
- Both `Edit_User` and `Edit_Role` SAP API configs already exist in `sap_api_configs` and are active.
- Request fields for `Edit_User`: `EDIT.USER`, `EDIT.FIRST_NAME`, `EDIT.LAST_NAME`, `EDIT.EMAIL`, `EDIT.CONTACT`, `EDIT.PASSWORD`, `EDIT.ZCONFPSWD`, `EDIT.STATUS`, `EDIT.PLANTS[].WERKS`, `EDIT.ROLES[].WERKS`, `EDIT.ROLES[].ROLE`.
- Request fields for `Edit_Role`: `EDIT.ROLE`, `EDIT.ROLE_DES`, `EDIT.ACTIVITY[].ACTIVITY`, `EDIT.ACTIVITY[].RELEASE_CODE`.

### Changes

#### 1. `src/lib/admin/user-mgmt.functions.ts`
Add two new server functions:

- **`editUserViaSap`**
  - Look up active config by aliases `["Edit_User", "EDITUSER", "Edit User"]` using `findSapConfigId`.
  - Build payload: `{ EDIT: { USER, FIRST_NAME, LAST_NAME, EMAIL, CONTACT, PASSWORD, ZCONFPSWD, STATUS, PLANTS: [...], ROLES: [...] } }`.
  - Invoke via `invokeViaMiddleware`.
  - Parse the SAP response for `STATUS`/`MESSAGE` success/error the same way `createUserViaSap` does.
  - Audit to `admin_audit_log`.
  - Return `{ ok, message, number }`.

- **`editCustomRoleViaSap`**
  - Look up active config by aliases `["Edit_Role", "EDITROLE", "Edit Role"]`.
  - Build payload: `{ EDIT: { ROLE, ROLE_DES, ACTIVITY: [...] } }`.
  - Invoke via `invokeViaMiddleware`.
  - Parse response the same way `createCustomRoleViaSap` does.
  - On SAP success, update the matching row in `custom_roles` (name, description) and re-insert `role_permissions` for the provided screen_keys.
  - Audit to `admin_audit_log`.
  - Return `{ ok, message, number }`.

#### 2. `src/routes/_authenticated/admin.users.tsx` — User dialog
Modify `CreateUserDialog`:
- Accept an optional `editUser?: SapUser` prop (shape from `listUsersViaSap`).
- When `editUser` is present:
  - Set title to `"Edit User"`.
  - Initialize `form` with the user's existing values (`sap_user_id`, `first_name`, `last_name`, `email`, `contact_number`, `status`).
  - Initialize `plants` from `editUser.plants`.
  - Initialize `roles` from `editUser.roles` mapped into `"<plant>::<role>"` format (reusing existing `RoleMultiSelect` composite values).
  - Disable the User ID field (SAP primary key, read-only in edit).
- Add an optional `confirm_password` that mirrors `password` (SAP `Edit_User` expects both `PASSWORD` and `ZCONFPSWD`).
- On submit, if `editUser` is present, call `editUserViaSap` instead of `createUserViaSap`.
- After success, call `onCreated()` (existing callback) so the parent invalidates queries and closes the dialog.

#### 3. `src/routes/_authenticated/admin.users.tsx` — Users table
In `UsersTab`:
- Add state for `editUserDialogOpen` and `editingUser`.
- Replace the current Edit Popover with a button that sets `editingUser` to the row and opens the dialog.
- Render `<CreateUserDialog open={editUserDialogOpen} onOpenChange={...} onCreated={...} editUser={editingUser} />`.

#### 4. `src/routes/_authenticated/admin.users.tsx` — Role dialog
The existing "Add New Role" dialog (inside `UserManagementPage`, controlled by `roleCreateOpen`) needs to support edit mode:
- Accept an optional `editRole?: { id, name, description, tenant_id, screen_keys[] }` prop.
- When in edit mode:
  - Title becomes `"Edit Role"`.
  - Pre-fill name, description, tenant, and screen permissions.
- On Save, if editing, call `editCustomRoleViaSap`; otherwise call `createCustomRoleViaSap`.
- After success, invalidate `admin-custom-roles` and close.

#### 5. `src/routes/_authenticated/admin.users.tsx` — Roles table
In `CustomRolesTab`:
- Remove the separate inline `editOpen` / `editForm` Dialog (lines ~517–618).
- Change the Pencil button to call an `onEditRole(role)` callback instead of opening the local dialog.
- `UserManagementPage` will pass `onEditRole` down; when invoked, it sets the edit role form state and opens `roleCreateOpen`.

### Technical details
- Password fields in Edit User: the SAP API expects both `PASSWORD` and `ZCONFPSWD`. The UI already has password + confirm password. In edit mode, the user may leave them blank (no password change) or enter a new password. The server function will send whatever is provided.
- For role permissions in Edit Role: the existing Add New Role dialog already has the full screen-key picker. In edit mode we pre-select the role's current `screen_keys` by querying `role_permissions` for that role. We already have the `custom_roles` list with screen keys available (or can fetch them).
- The `CreateUserDialog` currently lives inside `admin.users.tsx`. No new route files needed.
- All changes stay within the existing file except the two new server functions in `user-mgmt.functions.ts`.

### Out of scope
- No database schema changes.
- No new npm packages.
- No changes to the middleware.
- No changes to the SAP API Settings UI.

### Risks / open questions
- The SAP `Edit_User` response shape is assumed to follow the same `STATUS`/`MESSAGE` pattern as `Create_User`. If it differs, we may need to adjust `pickField` mappings after testing.
- In the Roles table, the current inline edit also allows toggling `is_active` via a Switch. The unified "Edit Role" popup does not have an Active toggle. We can either add one to the popup or keep the inline Switch for status and use the popup only for name/description/screens. I recommend adding an Active switch to the popup for parity.