
## Goal

Add two enterprise admin screens — **User Management** (`/admin/users`) and **SAP API Settings** (`/admin/sap-api`) — adapted from the attached spec to fit this Resustainability MM/SD Approvals app. Existing `profiles` + `user_roles` + `Admin` role + `has_role()` function are reused; new tables are added for tenants, custom roles, permissions, and dynamic SAP endpoint configs.

The current `/_authenticated/admin/users` route (simple role-assignment card) will be replaced with the new tabbed screen. The current `/_authenticated/admin/integrations` (static SAP env-var status) stays — the new `/admin/sap-api` screen is for dynamic, per-endpoint SAP REST configurations on top of it.

---

## Module A — User Management (`/admin/users`)

### New tables (migration)
- `tenants` — id, code (unique), name, is_active
- `user_tenants` — user_id, tenant_id, is_default (unique pair)
- `custom_roles` — id, name, description, tenant_id (nullable = global), is_active, created_by, created_at
- `user_custom_roles` — user_id, custom_role_id (unique pair), assigned_by, assigned_at
- `role_permissions` — custom_role_id OR built_in_role (app_role), screen_key, action (`view|create|edit|delete|approve|export`), allowed
- `approval_matrix` — tenant_id, stage_no, role_key, min_amount, max_amount, currency, is_active (used by Approval Matrix tab)
- `admin_audit_log` — actor_id, action, target_table, target_id, payload jsonb, created_at

All new tables: GRANT to authenticated + service_role, RLS on, policies use existing `public.has_role(uid, 'Admin')`. Self-mutation (changing own role / deleting own account) blocked at policy + UI.

### UI — `src/routes/_authenticated/admin.users.tsx` (rewrite)
- Header: title, helper text, **Tenant Scope** combobox (lists tenants + user counts + "All Tenants"). Stored in URL query `?tenant=`.
- `Tabs` with four panels:
  1. **Users** — searchable table (Name, Email, Built-in Role badge, Custom Role badges, Tenants popover with X-to-unassign, Joined date, Actions: Role / Delete). Disabled when row is self. "+ Invite User" dialog (email + full_name + initial role + tenant).
  2. **Custom Roles** — list cards with edit/delete; "+ New Role" dialog (name, description, tenant scope = current scope or Global). Delete blocked while users > 0.
  3. **Role Permissions** — matrix: rows = screen keys grouped by module (Approvals MM/SD, Admin, Reports, SAP), columns = actions (view/create/edit/delete/approve/export). Top role selector (built-in + custom). Toggles persist immediately + audit-logged.
  4. **Approval Matrix** — respects tenant scope. Table of stages (Stage #, Role, Min Amount, Max Amount, Currency, Active). Add/edit/delete rows.

Tabs 1–3 ignore tenant scope; tab 4 honors it.

---

## Module B — SAP API Settings (`/admin/sap-api`)

### New tables (same migration)
- `sap_api_configs` — id, name (unique), description, module (`MM|SD|COMMON`), endpoint_url, http_method, auth_type (`basic|oauth|none|proxy`), middleware_url, proxy_secret_ref (secret name, NOT value), api_type (`sync|fetch`), auto_sync_enabled, schedule_cron, last_synced_at, next_sync_at, is_active, created_by, timestamps
- `sap_api_credentials` — config_id (PK/FK), username, password_encrypted, extra_headers jsonb. **Service-role read only** (RLS denies all to authenticated).
- `sap_api_request_fields` — config_id, field_name, source (`static|column|expr|secret`), default_value, required, sort_order
- `sap_api_response_fields` — config_id, field_name, target_table, target_column, transform_expr, sort_order
- `sap_api_sync_log` — config_id, run_at, status, latency_ms, rows_processed, message

### UI

`src/routes/_authenticated/admin.sap-api.index.tsx` — list page:
- Header + "+ New Endpoint" + Import/Export JSON buttons.
- Card grid: name, module badge, auth-type badge, last-synced relative time, status dot, actions (Edit, Test, Duplicate, Delete).

`src/routes/_authenticated/admin.sap-api.$id.tsx` — edit page with six tabs:
1. **API Details** — two-column inputs over all `sap_api_configs` fields. Proxy mode validates middleware_url + proxy_secret_ref.
2. **Request Fields** — editable table of `sap_api_request_fields` with reorder, "Auto-detect from payload" (paste sample JSON → infer rows). Save replaces rows atomically.
3. **Response Fields** — same pattern for `sap_api_response_fields` with target table/column pickers.
4. **Credentials** — username + password (write-only; never echoed back) + extra headers JSON editor. Save goes through a server function using `supabaseAdmin`.
5. **Scheduler** — auto_sync toggle, cron input with human-readable preview, last/next run timestamps, manual "Run now".
6. **Connectivity** — Direct vs Proxy explainer, setup checklist for self-hosted middleware, **Test SAP Connection** button → calls server fn returning `{ ok, latency_ms, message }`.

### Server functions (`src/lib/admin/sap-api.functions.ts`)
- `listSapConfigs`, `getSapConfig`, `upsertSapConfig`, `deleteSapConfig`
- `replaceRequestFields`, `replaceResponseFields`
- `upsertCredentials` (admin-only, service-role write)
- `testSapConnection` — HEAD/GET on endpoint or `/__health` on middleware proxy
- `runSapSync` — manual trigger
- `exportConfigs` / `importConfigs` — JSON round-trip (excludes ids/timestamps/credentials)

All gated by `assertAdmin()` (same pattern as existing `integrations.functions.ts`). Audit-logged.

---

## Design / Conventions
- Reuse current red/slate enterprise theme + shadcn primitives (Card, Tabs, Table, Dialog, AlertDialog, Select, Switch, Popover, Badge, Skeleton, Sonner). No hard-coded colors.
- Sidebar nav (`_authenticated.tsx`): add **Admin** group with sub-items "Users & Roles", "SAP API Settings", "Integrations", "Strategies" (regroup existing items).
- Responsive: tables collapse to cards on mobile; tabs become a Select on `sm:`.

---

## Files

**New**
- `supabase/migrations/<ts>_user_mgmt_and_sap_api.sql`
- `src/lib/admin/user-mgmt.functions.ts`
- `src/lib/admin/sap-api.functions.ts`
- `src/lib/admin/screen-keys.ts` (constant list grouped by module)
- `src/routes/_authenticated/admin.sap-api.index.tsx`
- `src/routes/_authenticated/admin.sap-api.$id.tsx`
- `src/components/admin/tenant-scope-select.tsx`
- `src/components/admin/permission-matrix.tsx`
- `src/components/admin/users-tab.tsx`, `custom-roles-tab.tsx`, `role-permissions-tab.tsx`, `approval-matrix-tab.tsx`
- `src/components/admin/sap/{request-fields-table,response-fields-table,credentials-form,scheduler-form,connectivity-panel}.tsx`

**Modified**
- `src/routes/_authenticated/admin.users.tsx` — full rewrite to tabbed screen
- `src/routes/_authenticated.tsx` — add Admin nav group + SAP API link

---

## Out of scope (this plan)
- Actually wiring the middleware/ngrok deployment (the Connectivity tab provides the checklist + Test button only).
- Migrating existing static `SAP_BASE_URL` env-based client to the new dynamic configs — both coexist; switch-over is a follow-up.
- Real password encryption-at-rest (uses Supabase Vault placeholder + service-role-only RLS for v1).

Confirm and I'll implement, or tell me which pieces to drop/reshape (e.g., skip Approval Matrix tab, skip Import/Export, etc.).
