## Why the API "isn't called"
The handler already invokes SAP, but the success check is `STATUS === "TRUE"`. The real `ROLE_CREATE` response uses `STATUS: "SUCCESS"`, so every call is treated as a failure and the dialog shows the SAP error toast — making it look like nothing happened. The payload field names are also wrong (`DESCRIPTION` / `PLANTS` instead of `ROLE_DES` / `ACTIVITY`).

## Changes

### 1. `src/lib/admin/user-mgmt.functions.ts` — rewrite `createCustomRoleViaSap`
- Input adds `activities: { ACTIVITY: string; RELEASE_CODE: string }[]` (min 1, each ACTIVITY 1–30, RELEASE_CODE 1–10). Keep `name`, `description`, `tenant_id` (tenant_id retained so the local `custom_roles` row keeps its scope; it is **not** sent to SAP).
- Drop the `tenants → PLANTS` lookup.
- New payload:
  ```ts
  { CREATE: {
      ROLE: name.toUpperCase(),
      ROLE_DES: description ?? "",
      ACTIVITY: activities.map(a => ({
        ACTIVITY: a.ACTIVITY.toUpperCase(),
        RELEASE_CODE: a.RELEASE_CODE,
      })),
  } }
  ```
- Success check: `result.ok && (STATUS === "SUCCESS" || STATUS === "TRUE" || STATUS === "")`. Keep `USER_CREATE` behavior unchanged.
- On success, insert into `custom_roles { name, description, tenant_id }` as today (db_error returned, not thrown).
- Audit log unchanged in shape (request scrubbed of nothing sensitive).

### 2. `src/routes/_authenticated/admin.users.tsx` — Add Role dialog UI
- Extend `roleForm` state: `activities: { ACTIVITY: string; RELEASE_CODE: string }[]` (default `[]`).
- Add an **Activities** section in the dialog (below Tenant scope):
  - Multi-select of activity names sourced from `PERMISSION_ACTIONS` in `src/lib/admin/screen-keys.ts` (view, create, edit, delete, approve, export) — these are the "Screen Permissions" actions.
  - When an activity is checked, render an inline `Input` next to it for `RELEASE_CODE` (free-text, 2-char hint). Suggest codes from the Release Strategies table via a small datalist populated from `approval_strategies` (use `id` substring or a per-row code — datalist is suggestions only, the field stays editable since `approval_strategies` has no dedicated release_code column).
  - Validation in `submitCreateRole`: at least one activity and every selected activity must have a non-empty RELEASE_CODE → `toast.error` otherwise.
- Pass `activities` through to `createRoleSap({ data: { name, description, tenant_id, activities } })`.
- Reset `activities` to `[]` on success.

### 3. No schema/migration changes
`custom_roles`, `approval_strategies`, `sap_api_configs` already exist. ACTIVITY is sent to SAP only — not persisted locally in this change.

## Out of scope
- Persisting activity/release-code mapping into `role_permissions` (current Role Permissions tab keeps managing that).
- Editing existing custom roles via SAP.
- Adding a `release_code` column to `approval_strategies`.

## After applying
Custom Roles → Add Role → enter name, optional description, pick tenant scope, tick one or more activities and type a release code for each → Create. The SAP `ROLE_CREATE` endpoint is called with `{ CREATE: { ROLE, ROLE_DES, ACTIVITY:[…] } }`; `STATUS: "SUCCESS"` is treated as success, the role lands in `custom_roles`, and the dialog closes with a success toast. SAP rejections show the SAP `MESSAGE` and keep the dialog open.
