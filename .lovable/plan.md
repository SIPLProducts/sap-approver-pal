# Fill the Quality database with the SAP API, roles and permission data

## What the numbers tell us

The Lovable Cloud database (the one this app uses in preview/published) contains:

- 47 SAP API endpoints (all active)
- 406 request fields and 755 response fields for those endpoints
- 8 custom roles and 397 role permission rows
- 15 profiles, 5 built-in role assignments

Your self-hosted Quality database returned almost nothing for the same query. So the
Quality server is running the correct application, but its database was created empty:
the schema exists (that's why login works and pages render), but the configuration rows
were never copied over. Nothing is wrong with the code — the data is simply missing on
that server.

Roles, users and SAP API screens show no data for exactly the same reason.

## What will be delivered

A single seed file, `scripts/quality-seed-data.sql`, generated from the current Cloud
data, containing:

1. All 47 rows of `sap_api_configs` (with their request/response field mappings)
2. All `custom_roles` and `role_permissions` rows, so Roles & Permissions screens work
3. `approval_matrix` / `approval_strategies` rows if present
4. `tenants` / `user_tenants` rows if present

Excluded on purpose:

- Secrets (`sap_api_credentials`, `sap_global_secrets`, `email_no_reply_secrets`) — those
  stay server-local and are set with the existing `scripts/quality-sap-config.sql`
- `profiles` / `user_roles` — these are tied to accounts in the Quality auth system.
  Users created there get their profile automatically; role assignment is then done from
  the User Management screen (the first account created becomes Admin).

Every statement is written as an upsert (`on conflict do update`), so the file is safe to
run more than once and will not duplicate rows.

## How you will use it

On the Quality server:

```bash
docker exec -i supabase-db psql -U postgres -d postgres < quality-seed-data.sql
```

Then reload the SAP API Settings screen — the 47 endpoints will be listed. After that,
run the existing `quality-sap-config.sql` once to set the SAP base URL, technical user
password, and middleware secret for that environment.

## Verification query

The file ends with the counts so you can confirm the load in one look:

```sql
select 'sap_api_configs' t, count(*) from public.sap_api_configs
union all select 'request_fields', count(*) from public.sap_api_request_fields
union all select 'response_fields', count(*) from public.sap_api_response_fields
union all select 'custom_roles', count(*) from public.custom_roles
union all select 'role_permissions', count(*) from public.role_permissions;
```

Expected: 47 / 406 / 755 / 8 / 397.

## Technical notes

- The seed is produced by reading rows from the Cloud database and emitting literal
  `INSERT ... ON CONFLICT` statements — no `pg_dump`, no schema changes, no migration.
- Foreign-key order is respected: configs before their field mappings, custom roles
  before role permissions.
- `created_by` / `updated_by` user references are written as `NULL`, because those user
  ids do not exist in the Quality auth system and would break the insert.
