# Load the full schema and configuration into the Production database

Production Supabase now opens, so the next step is to give it the same tables and configuration rows
that Quality has. Everything needed already exists in the repository — nothing new has to be written.

## What will be loaded

Schema (17 migration files in `supabase/migrations/`, applied in filename order). Together they create:

- enum types `app_role`, `sap_module`, `document_type`, `doc_status`, `step_status`
- `profiles`, `user_roles`, `user_custom_roles`, `custom_roles`, `role_permissions`
- `tenants`, `user_tenants`, `approval_matrix`, `approval_strategies`
- `approval_documents`, `approval_steps`, `approval_line_items`, `approval_attachments`
- `sap_api_configs`, `sap_api_credentials`, `sap_api_request_fields`, `sap_api_response_fields`,
  `sap_api_sync_log`
- `sap_global_settings`, `sap_global_secrets`, `email_no_reply_config`, `email_no_reply_secrets`
- `notifications`, `push_subscriptions`, `audit_log`, `admin_audit_log`
- the RLS policies, grants, triggers and the `has_role` / `is_admin` / `handle_new_user` functions

Configuration data, from `scripts/quality-seed-data.sql` (every statement is an upsert, safe to re-run):

- 47 `sap_api_configs` endpoint rows — **includes `Login_API`**
- 406 `sap_api_request_fields`
- 755 `sap_api_response_fields`
- 8 `custom_roles`, 397 `role_permissions`, 17 `approval_strategies`

Use `quality-seed-data.sql`, not the `-sql-editor` or `part1/2/3` variants: those deliberately skip the
`Login_API` endpoint row because it already existed on the Quality server. Production is empty, so it
needs the full file or login will have no endpoint definition.

No user accounts and no secrets are included — those are created separately in step 4.

## 1. Copy the SQL to the Production server

From the repo checkout on the server (or `scp` from the build machine):

```bash
mkdir -p /data/webapplication/resl_approval/Production/scripts
cp /path/to/repo/supabase/migrations/*.sql \
   /path/to/repo/scripts/quality-seed-data.sql \
   /path/to/repo/scripts/quality-sap-config.sql \
   /data/webapplication/resl_approval/Production/scripts/
```

## 2. Apply the schema

Run inside the Production database container so no host port is involved:

```bash
cd /data/webapplication/resl_approval/Production/scripts

for f in $(ls 2026*.sql | sort); do
  echo "=== $f"
  docker exec -i supabase-prod-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$f" || break
done
```

Use `supabase-prod-db` — never `supabase-db`, which is Quality.

Confirm the tables landed:

```bash
docker exec -i supabase-prod-db psql -U postgres -d postgres -c \
  "select table_name from information_schema.tables where table_schema='public' order by 1;"
```

Expect roughly 28 tables, matching the list above.

## 3. Load the configuration rows

```bash
docker exec -i supabase-prod-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < quality-seed-data.sql

docker exec -i supabase-prod-db psql -U postgres -d postgres -c \
  "select
     (select count(*) from public.sap_api_configs)          as endpoints,
     (select count(*) from public.sap_api_request_fields)   as req_fields,
     (select count(*) from public.sap_api_response_fields)  as resp_fields,
     (select count(*) from public.custom_roles)             as roles,
     (select count(*) from public.role_permissions)         as perms,
     (select count(*) from public.approval_strategies)      as strategies;"
```

Target counts: 47 / 406 / 755 / 8 / 397 / 17.

Also confirm login has its endpoint:

```bash
docker exec -i supabase-prod-db psql -U postgres -d postgres -c \
  "select name, endpoint_url, is_active from public.sap_api_configs where name = 'Login_API';"
```

## 4. Production-specific rows (must differ from Quality)

`quality-sap-config.sql` seeds `sap_global_settings` / `sap_global_secrets`. Edit its two placeholders
to Production values **before** running it, then point the middleware row at Production's port 3010:

```sql
update public.sap_global_settings
   set connection_mode = 'via_proxy',
       middleware_port = 3010,
       middleware_url  = 'http://127.0.0.1:3010'
 where id = 'default';

update public.sap_global_secrets
   set proxy_secret = '<Production MIDDLEWARE_SHARED_SECRET>'
 where id = 'default';
```

The proxy secret must match Production's middleware `.env` and stay different from Quality's.

## 5. First admin user

Create the user in Production Studio (`http://127.0.0.1:3100` → Authentication → Add user), then:

```sql
insert into public.user_roles (user_id, role)
select id, 'Admin' from auth.users where email = '<admin email>'
on conflict do nothing;
```

`handle_new_user` already creates the matching `profiles` row and grants Admin to the very first user,
so this insert is only a safety net.

## 6. Final check

```bash
docker exec -i supabase-prod-db psql -U postgres -d postgres -c \
  "select count(*) from public.profiles;"
curl -i -H "apikey: <PRODUCTION_ANON_KEY>" http://127.0.0.1:8010/rest/v1/sap_api_configs?select=name
```

Then sign in at `http://10.150.150.130:9091/login` and open **Admin → SAP API Settings** — the 47
endpoints should be listed, and User Management should show the roles and screens.

## Safety notes

- Every command targets `supabase-prod-db`; Quality's `supabase-db` is never touched.
- The seed file is upsert-only, so re-running it does not duplicate rows.
- Production keeps its own password, JWT secret, API keys, and middleware secret.

No application code changes are required.
