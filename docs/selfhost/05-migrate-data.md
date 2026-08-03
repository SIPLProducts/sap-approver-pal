# 05 — Migrating the data to your Supabase

Goal: reproduce the current backend (schema, RLS, functions, application data,
users) inside the self-hosted stack.

## What can and cannot be exported

| Item | Available? |
|---|---|
| Public schema, tables, functions, policies, grants | Yes — via `pg_dump` from the current database |
| Application table data | Yes |
| `auth.users` rows (including password hashes) | Yes, if your dump includes the `auth` schema |
| Lovable Cloud service-role key / DB password | **No** — not retrievable. You generated fresh keys in step 04 |
| Storage objects | Yes (none in use today) |

Because the keys cannot be exported, the self-hosted stack always uses the new
key set. Sessions issued by the old backend are not valid on the new one; users
sign in again after cutover.

## 1. Produce the source dump

Run this from a machine that can reach the current database, using its
connection string. **You perform this export from your side** — Lovable Cloud
does not hand out the database password, so use the dump you obtain from your
project's backend export.

```bash
mkdir -p ~/resl-migration && cd ~/resl-migration

# Roles are not needed (the target has its own); schema + data are.
pg_dump "$SOURCE_DB_URL" \
  --schema=public --schema=auth \
  --no-owner --no-privileges --no-publications --no-subscriptions \
  --exclude-table-data='auth.refresh_tokens' \
  --exclude-table-data='auth.sessions' \
  --exclude-table-data='auth.audit_log_entries' \
  -Fc -f resl-source.dump

pg_restore -l resl-source.dump | head -40      # sanity check
```

If you only have a plain SQL export, that works too — skip `pg_restore` below
and use `psql -f`.

## 2. Copy it to the server

```bash
scp resl-source.dump deploy@your-server:/data/webapplication/resl_approval/backups/
```

## 3. Restore into Quality first

```bash
cd /data/webapplication/resl_approval
DUMP=backups/resl-source.dump

docker cp "$DUMP" supabase-db:/tmp/resl-source.dump

# Extensions the app relies on
docker exec -i supabase-db psql -U postgres -d postgres -c \
  'create extension if not exists pgcrypto; create extension if not exists "uuid-ossp";'

# Restore. --clean drops objects it is about to recreate; safe on a fresh stack.
docker exec -i supabase-db pg_restore -U postgres -d postgres \
  --no-owner --no-privileges --clean --if-exists /tmp/resl-source.dump 2>&1 | tail -40
```

Errors mentioning `role "supabase_admin" does not exist`, `extension already
exists`, or objects in `auth` that GoTrue already created are expected and
harmless. Anything referring to a `public.*` table is not — investigate it.

## 4. Re-apply grants

PostgREST needs explicit grants on every public table. Re-assert them after the
restore:

```bash
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
grant usage on schema public to anon, authenticated, service_role;

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t.tablename);
    execute format('grant all on public.%I to service_role', t.tablename);
  end loop;
end $$;

grant execute on all functions in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
SQL
```

> This grants `authenticated` broad table privileges; RLS still decides which
> rows are visible. Do not add blanket `anon` grants — every policy in this app
> is scoped to `auth.uid()` or an admin role check.

## 5. Verify the restore

```bash
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
-- Row counts for the application tables
select 'profiles' t, count(*) from profiles
union all select 'user_roles', count(*) from user_roles
union all select 'custom_roles', count(*) from custom_roles
union all select 'user_custom_roles', count(*) from user_custom_roles
union all select 'role_permissions', count(*) from role_permissions
union all select 'tenants', count(*) from tenants
union all select 'user_tenants', count(*) from user_tenants
union all select 'approval_documents', count(*) from approval_documents
union all select 'approval_steps', count(*) from approval_steps
union all select 'approval_line_items', count(*) from approval_line_items
union all select 'approval_matrix', count(*) from approval_matrix
union all select 'approval_strategies', count(*) from approval_strategies
union all select 'sap_api_configs', count(*) from sap_api_configs
union all select 'sap_api_credentials', count(*) from sap_api_credentials
union all select 'sap_api_request_fields', count(*) from sap_api_request_fields
union all select 'sap_api_response_fields', count(*) from sap_api_response_fields
union all select 'sap_global_settings', count(*) from sap_global_settings
union all select 'email_no_reply_config', count(*) from email_no_reply_config
union all select 'notifications', count(*) from notifications
union all select 'push_subscriptions', count(*) from push_subscriptions
order by 1;

-- RLS must be on for every public table
select tablename, rowsecurity from pg_tables
where schemaname='public' and rowsecurity = false;

-- Policy count per table
select tablename, count(*) from pg_policies
where schemaname='public' group by 1 order by 1;

-- Functions the app calls
select proname, prosecdef from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' order by 1;

-- Users
select count(*) from auth.users;
SQL
```

Compare each count against the source. Any table with `rowsecurity = false`
must be fixed before Production.

## 6. Users and passwords

Password hashes carry over with the `auth.users` rows, so existing
email/password logins keep working. Two things to check:

- **SAP-authenticated users.** This app signs users in through the
  `Login_API` configured in Admin → SAP API Settings; those credentials live in
  SAP, not in Postgres, so nothing to migrate — the SAP API config rows must
  simply be present (verified above).
- **First admin.** `handle_new_user()` grants `Admin` to the first user only.
  If no admin came across, grant one manually:

```bash
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
insert into public.user_roles (user_id, role)
select id, 'Admin' from auth.users where email = 'you@yourdomain.com'
on conflict do nothing;
SQL
```

## 7. Repeat for Production

Same steps against the Production stack:

```bash
docker cp backups/resl-source.dump supabase-db-prod:/tmp/resl-source.dump
# ...same pg_restore / grants / verification, using the production container name
```

Container names differ per compose project — list them with
`docker compose -p resl_production ps`.

## 8. Rollback

Nothing about this migration touches the current Lovable-hosted backend. If the
self-hosted stack misbehaves, keep using the hosted app and retry. To reset a
self-hosted stack completely:

```bash
cd /data/webapplication/resl_approval/Quality/supabase
docker compose -p resl_quality down -v      # destroys the volumes
docker compose -p resl_quality up -d        # fresh stack, restore again
```

`-v` deletes data irreversibly. Never run it against Production without a
verified backup.

Next: [06 — Application deployment](./06-app-deploy.md)
