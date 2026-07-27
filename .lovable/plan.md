## Problem

Custom Roles tab shows "No custom roles yet" even though 7 rows exist in `custom_roles`. Cause: the recent security migration tightened the SELECT policy to:

```
is_admin(auth.uid()) OR EXISTS (user_tenants where tenant_id = custom_roles.tenant_id AND user_id = auth.uid())
```

The signed-in SAP user (`SHARVI_RSSPL`) has no row in `public.user_roles`, so `is_admin()` returns false. All existing `custom_roles` rows have `tenant_id IS NULL` (global roles), so the `user_tenants` sub-select never matches either. RLS filters everything out → the tab renders empty. Same policy shape is on `role_permissions`, `approval_matrix`, and `approval_strategies`, so those tabs are affected identically for SAP-authenticated admins.

## Fix (database only, one migration)

Update the read policies on the four admin-config tables so global rows (`tenant_id IS NULL`) remain visible to any authenticated user, while tenant-scoped rows stay restricted to members of that tenant. Admin-write policies are unchanged.

Tables and new SELECT rule (drop-and-recreate the existing "read" policy on each):

- `public.custom_roles`
- `public.role_permissions` (join to `custom_roles.tenant_id`)
- `public.approval_matrix`
- `public.approval_strategies`

New USING expression pattern:

```sql
is_admin(auth.uid())
OR tenant_id IS NULL
OR EXISTS (
  SELECT 1 FROM public.user_tenants ut
  WHERE ut.user_id = auth.uid() AND ut.tenant_id = <table>.tenant_id
)
```

For `role_permissions`, the tenant scope is derived from its parent `custom_roles.tenant_id` via an EXISTS join (same shape as the current policy).

No app/frontend code changes. No changes to write policies, GRANTs, or table shape.

## Verification

- Reload `/admin/users` → Custom Roles tab, as `SHARVI_RSSPL`: all 7 roles list.
- Role Permissions tab: role dropdown populated; toggles still persist (write policy still admin-only).
- Approval Matrix and Release Strategies tabs continue to load rows they previously loaded; tenant-scoped rows still hidden from non-members (spot-check by querying with a non-admin session).
- Users tab and edit flow unaffected.
