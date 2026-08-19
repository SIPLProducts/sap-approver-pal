# Load all SAP API configuration (including Login_API) into the Production database

## Which file to use, and why

`scripts/quality-seed-data.sql` is the correct one. Confirmed contents:

- 47 `sap_api_configs` rows, **including `Login_API`**
  (id `f91324c1-7ba1-48fd-a10e-f7c951d2670a`, `COMMON`, `POST`, `basic`,
  `/sd_approval_mng/login/login?sap-client=300`, active) plus its 17 field-mapping rows
- 406 `sap_api_request_fields`
- 755 `sap_api_response_fields`
- 8 `custom_roles`, 397 `role_permissions`, 17 `approval_strategies`
- ends with a row-count summary query

Do **not** use `quality-seed-data-sql-editor.sql` or `quality-seed-part1/2/3-*.sql`. Those variants
deliberately omit the `Login_API` endpoint row because it already existed on the Quality server — on
Production that is exactly the row you are missing.

The file contains no secrets and no user accounts, and every statement is an upsert, so it is safe to
re-run. SAP connection details and the middleware secret come from `scripts/quality-sap-config.sql`
in step 4.

## 1. Copy the file to the Production server

```bash
mkdir -p /data/webapplication/resl_approval/Production/scripts
cp /path/to/repo/scripts/quality-seed-data.sql \
   /path/to/repo/scripts/quality-sap-config.sql \
   /data/webapplication/resl_approval/Production/scripts/
```

## 2. Confirm the schema exists first

The seed only inserts rows; the tables must already be there.

```bash
docker exec -i supabase-prod-db psql -U postgres -d postgres -c \
  "select count(*) as sap_tables from information_schema.tables
    where table_schema='public' and table_name like 'sap_api%';"
```

Expect 5. If it returns 0, apply the migrations first:

```bash
cd /data/webapplication/resl_approval/Production/scripts
for f in $(ls 2026*.sql | sort); do
  echo "=== $f"
  docker exec -i supabase-prod-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$f" || break
done
```

## 3. Load all the SAP API configuration — the command you asked for

```bash
cd /data/webapplication/resl_approval/Production/scripts

docker exec -i supabase-prod-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < quality-seed-data.sql
```

Always `supabase-prod-db`. Never `supabase-db` — that is Quality.

Verify:

```bash
docker exec -i supabase-prod-db psql -U postgres -d postgres -c \
  "select
     (select count(*) from public.sap_api_configs)         as endpoints,
     (select count(*) from public.sap_api_request_fields)  as req_fields,
     (select count(*) from public.sap_api_response_fields) as resp_fields,
     (select count(*) from public.custom_roles)            as roles,
     (select count(*) from public.role_permissions)        as perms,
     (select count(*) from public.approval_strategies)     as strategies;"

docker exec -i supabase-prod-db psql -U postgres -d postgres -c \
  "select name, module, http_method, endpoint_url, auth_type, is_active
     from public.sap_api_configs where name = 'Login_API';"

docker exec -i supabase-prod-db psql -U postgres -d postgres -c \
  "select count(*) as login_request_fields
     from public.sap_api_request_fields
    where config_id = 'f91324c1-7ba1-48fd-a10e-f7c951d2670a';"
```

Targets: 47 / 406 / 755 / 8 / 397 / 17, one `Login_API` row, and its field mappings present.

## 4. Production SAP connection and middleware secret

These are environment-specific and are **not** in the seed file. Edit the two placeholders in
`quality-sap-config.sql` (`REPLACE_MIDDLEWARE_SECRET`, `REPLACE_SAP_PASSWORD`) to Production values,
then:

```bash
docker exec -i supabase-prod-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < quality-sap-config.sql

docker exec -i supabase-prod-db psql -U postgres -d postgres -c \
  "update public.sap_global_settings
      set connection_mode = 'via_proxy',
          middleware_port = 3010,
          middleware_url  = 'http://127.0.0.1:3010'
    where id = 'default';"
```

Alternatively set these through the app UI after login: **Admin → SAP API Settings → SAP Connection**
(base URL, username, password) and **Middleware Configuration** (URL `http://127.0.0.1:3010`, proxy
secret matching Production's middleware `.env`).

## 5. Confirm through the app

```bash
curl -i -H "apikey: <PRODUCTION_ANON_KEY>" \
  "http://127.0.0.1:8010/rest/v1/sap_api_configs?select=name&limit=5"
```

Then open **Admin → SAP API Settings**; all 47 endpoints including `Login_API` should be listed, and
SAP login should work once the middleware and SAP credentials from step 4 are in place.

No application code changes are required.
