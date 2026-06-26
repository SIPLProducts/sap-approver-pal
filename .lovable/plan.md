# Fix "ROLE_CREATE not configured" lookup mismatch

## Problem
`createCustomRoleViaSap` looks up `sap_api_configs.name = 'ROLE_CREATE'`, but the row in the DB is named **"Create role"**. Same friendly-name mismatch exists for `USER_CREATE` (row is "Create User") and likely `ROLE_LIST`.

## Fix — single file: `src/lib/admin/user-mgmt.functions.ts`

Add a small helper that resolves a SAP config by trying multiple aliases case-insensitively:

```ts
async function findSapConfigId(aliases: string[]): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, "");
  const wanted = new Set(aliases.map(norm));
  const { data } = await supabaseAdmin
    .from("sap_api_configs")
    .select("id, name, is_active");
  const match = (data ?? []).find(r => r.is_active && wanted.has(norm(r.name)));
  return match?.id ?? null;
}
```

Replace the three existing `.eq("name", "...").maybeSingle()` lookups with:

- `createCustomRoleViaSap` → `findSapConfigId(["ROLE_CREATE", "Create Role", "CreateRole"])`
- `createUserViaSap` → `findSapConfigId(["USER_CREATE", "Create User", "CreateUser"])`
- `listRolesForPlants` → `findSapConfigId(["ROLE_LIST", "Get Roles", "Role List", "GetRoles"])`

Error messages updated to list accepted aliases so admins know what to name new configs.

## Out of scope
- No DB renames.
- No schema or UI changes.
- Lookup normalization strips spaces/underscores/hyphens and is case-insensitive — `Create role`, `CREATE_ROLE`, `create-role` all match.
