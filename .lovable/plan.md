## Goal
When the user clicks Create in the "Add Role" popup (Custom Roles tab), first call the SAP API config named `ROLE_CREATE` with `{ CREATE: { ROLE, DESCRIPTION, PLANTS:[{WERKS}] } }`. Only on SAP success, insert the row into `custom_roles`.

## Changes

### 1. New server function `createCustomRoleViaSap`
File: `src/lib/admin/user-mgmt.functions.ts`

- Admin-only (`assertAdmin`), `requireSupabaseAuth` middleware.
- Input (zod):
  - `name: string` (1-60)
  - `description?: string` (max 240)
  - `tenant_id?: string` (uuid; "" treated as global)
- Resolve plant code(s):
  - If `tenant_id` provided → look up `tenants.code` for that id → `PLANTS: [{ WERKS: code }]`.
  - If omitted (Global) → look up all `tenants.code` rows → `PLANTS: tenants.map(...)`. If none exist, send `PLANTS: []`.
- Load `sap_api_configs` where `name = 'ROLE_CREATE'`; if missing, throw a clear "Add a config named ROLE_CREATE in SAP API Settings" error (matches the USER_CREATE pattern).
- Build payload:
  ```ts
  { CREATE: {
      ROLE: name.toUpperCase(),
      DESCRIPTION: description ?? "",
      PLANTS: [{ WERKS: <code> }, ...],
  } }
  ```
- `invokeViaMiddleware(cfg.id, payload)`; treat `sapBody.STATUS === "TRUE"` (or HTTP ok when STATUS absent) as success. On failure, throw `sapBody.MESSAGE || result.error`.
- On success, insert into `custom_roles { name, description, tenant_id }` (tenant_id null when global). If the insert fails (e.g. duplicate), return `{ ok: true, sap: true, db_error: <msg> }` so UI can still toast SAP success but show the DB warning.
- Audit-log `user.sap_role_create` with request (no secrets) + response snapshot + DB outcome.
- Return `{ ok: true, message, number? }`.

### 2. Wire submit handler to call SAP first
File: `src/routes/_authenticated/admin.users.tsx`

- Import `createCustomRoleViaSap` from `@/lib/admin/user-mgmt.functions`.
- Replace `submitCreateRole` body:
  - Validate `name` (existing).
  - Use `useServerFn(createCustomRoleViaSap)` and `await` with `{ data: { name, description, tenant_id } }` where `tenant_id` resolves to `roleForm.tenant_id || (tenantScope !== "all" ? tenantScope : "")`.
  - On thrown error → `toast.error(err.message)` and keep dialog open.
  - On success → toast SAP message, close dialog, reset form, invalidate `admin-custom-roles`. If response includes `db_error`, also `toast.warning(db_error)`.
- Add a small loading state (`creatingRole`) to disable the Create button while the call is in flight.

### 3. No schema / migration changes
`custom_roles` already exists. `sap_api_configs` row for `ROLE_CREATE` is configured manually in SAP API Settings (same model as `USER_CREATE` / `ROLE_LIST`).

## Out of scope
- Editing custom roles via SAP (only create).
- Per-screen permission mapping.
- Multi-plant selector inside the Add Role dialog — the existing "Tenant scope" select drives the single WERKS; Global sends all known plant codes.

## After applying
Open Custom Roles → Add Role → fill name/description, optionally pick tenant → Create. The SAP `ROLE_CREATE` endpoint is called; on success the row appears in the custom_roles list. Any SAP rejection is shown as an inline toast and the dialog stays open.
