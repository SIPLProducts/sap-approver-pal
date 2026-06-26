# Integrate SAP Plant F4 in Create User

## Goal

In the Create User dialog (Users tab), replace the current "Tenant (optional)" `Select` with a Plant picker driven by the SAP `Get_Plant` F4 API — exactly the source used by `PlantSelect` in `sd.price.tsx`. The selected plant(s) are persisted against the new user and shown in the existing "Plants" column of the Users table.

## Scope

Frontend + a small server-function change. No SQL/schema changes — `user_tenants` already maps users to tenants and the Plants column already reads from it.

## Changes

### 1. `src/components/sap/plant-multi-select.tsx` (new)

A multi-select variant of `PlantSelect` that reuses the same `getPlantConfig` + `runSapApi` data flow:
- Same Popover + Command UI as `PlantSelect`.
- `value: string[]`, `onChange: (next: string[]) => void`.
- Each `CommandItem` toggles membership; selected items get the `Check` icon.
- Trigger shows comma-joined codes (truncated) or placeholder.
- Same fallback behavior when `Get_Plant` config is missing — render a plain text input that accepts comma-separated codes.

This keeps `PlantSelect` (single-select) untouched for the Price Approval screen.

### 2. `src/routes/_authenticated/admin.users.tsx`

In `UserManagementPage`:
- Change `inviteForm.tenant_id: ""` to `inviteForm.plants: string[]` (initial `[]`).
- Replace the "Tenant (optional)" `<Select>` block in the dialog with `<PlantMultiSelect value={inviteForm.plants} onChange={...} />` labelled "Plants".
- In `submitInvite`, send `plants: inviteForm.plants` to the server fn instead of `tenant_id`.
- Drop the `tenants` prop dependency for the dialog body (still used by `UsersTab` for the filter and by Custom Roles).

### 3. `src/lib/admin/user-mgmt.functions.ts`

Update `inviteUser` input + handler:
- Replace `tenant_id` with `plants: z.array(z.string().min(1)).max(50).optional()`.
- After invite, look up tenants by `code IN plants`, then bulk-insert into `user_tenants` (`is_default: true` on the first one).
- Unknown codes: skip silently and include the skipped list in the audit-log payload (no UI error — the codes come from SAP, mismatches mean the tenant row is missing).
- Audit-log payload includes `plants` instead of `tenant_id`.

## Technical notes

- The Users table's "Plants" column already reads `user_tenants` joined with `tenants(code, name)`. No render change needed — it lights up automatically once rows are inserted.
- `Get_Plant` returns codes (`VKORG`); `tenants.code` stores the same code, so the join is direct.
- `PlantMultiSelect` uses the same query keys (`sap-plant-config`, `sap-plants`) as `PlantSelect`, so cache is shared — no duplicate SAP calls.
- The "Tenant scope" dropdown on Custom Roles and the "All Plants" filter in the Users tab continue to use the `tenants` table query as today.

## Out of scope

- No edit-user plant assignment (current screen has no edit-tenants UI; this plan only matches the request for the create flow).
- No schema changes; `user_tenants` already exists with the right shape.
- No styling/theme changes.
