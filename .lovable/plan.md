# Fix SAP API sync rollback from duplicate role permissions

## What is happening

The sync script is running inside one transaction. When it reaches `role_permissions`, it tries to insert a permission row using `ON CONFLICT (id)`, but the target database already has the same permission under the natural unique key `(custom_role_id, screen_key, action)` with a different `id`. That duplicate-key error aborts the transaction, so the SAP API config inserts/updates are rolled back and the APIs still do not appear.

## Plan

1. Update `scripts/generate-sap-sync.py` so `role_permissions` syncs by the actual permission identity, not only by `id`:
   - For custom-role permissions: match by `(custom_role_id, screen_key, action)`.
   - For built-in-role permissions: match by `(built_in_role, screen_key, action)` if applicable.
   - Update existing rows first, then insert only when no matching permission exists.

2. Regenerate `scripts/sync-sap-config.sql` from the fixed generator.

3. Keep the sync in one transaction, but make the role-permission section safe to rerun repeatedly without duplicate-key failures.

4. Update the deployment docs with the exact rerun command and the expected success checks:
   - Use `-v ON_ERROR_STOP=1`.
   - After completion, the verification query for missing APIs should return no rows.

## Technical details

- The SAP API config section can already update or insert by API `name`.
- The failing section is the generated `role_permissions` SQL because it only handles conflicts on `id`, while the database also enforces a unique permission identity.
- No application UI changes are needed for this fix.