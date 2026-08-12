# Why screens are empty on Quality — checks and queries

## What we know from the code

- Login works because the SAP login call is an **unauthenticated** server function: it goes app → middleware → SAP, no backend token needed.
- Every admin screen (SAP API Settings list, Users & Roles, Custom Roles, Role Permissions) calls **authenticated** server functions that validate the browser's backend session token on the server. The screenshot shows `Unauthorized: Invalid token`, which is exactly that validation failing.
- So there are two possible causes, and they need to be separated before changing anything:
  1. The backend session token is not accepted by the app server (wrong/unreachable backend URL or key on the Quality app server) — this would make **all** admin screens empty at once, even when the tables are full.
  2. The Quality database genuinely has no rows in `sap_api_configs` — then SAP API Settings would be legitimately empty, and Users would fail because it needs the `Create_User_Display_Table` endpoint config.

Login succeeding tells us at least one row (`Login_API`) exists, which points at cause 1 as the main problem — but confirm with the queries below rather than assuming.

## Step 1 — Queries to run on the Quality database

On the Quality server:

```bash
docker exec -i supabase-db psql -U postgres -d postgres
```

```sql
-- 1. How many SAP endpoints exist, and are they active?
select count(*) as total, count(*) filter (where is_active) as active
from public.sap_api_configs;

-- 2. List them (this is exactly what SAP API Settings should show)
select name, module, http_method, api_type, is_active, endpoint_url
from public.sap_api_configs
order by name;

-- 3. Are the endpoints the admin screens need present?
select expected, exists (
         select 1 from public.sap_api_configs c
         where lower(replace(replace(c.name,' ',''),'_','')) =
               lower(replace(replace(expected,' ',''),'_','')) and c.is_active
       ) as configured
from (values ('Login_API'),('Create_User_Display_Table'),('USER_CREATE'),
             ('Edit_User'),('ROLE_LIST'),('ROLE_CREATE'),('Edit_Role')) t(expected);

-- 4. Global SAP / middleware settings the calls depend on
select id, connection_mode, deployment_mode, middleware_url, sap_base_url, sap_username
from public.sap_global_settings;
select id, (proxy_secret is not null and proxy_secret <> '') as has_proxy_secret,
       (sap_password is not null and sap_password <> '') as has_sap_password
from public.sap_global_secrets;

-- 5. Did login actually create a backend user + profile with SAP permissions?
select u.email, u.created_at, u.last_sign_in_at
from auth.users u order by u.created_at desc limit 10;

select p.email,
       (p.sap_profile is not null) as has_sap_profile,
       jsonb_array_length(coalesce(p.sap_profile->'plants','[]'::jsonb)) as plants
from public.profiles p order by p.updated_at desc limit 10;

-- 6. Built-in admin role rows
select ur.role, p.email from public.user_roles ur
left join public.profiles p on p.id = ur.user_id;
```

Interpretation:
- Query 2 returns rows but the screen is empty → the problem is the token, not the data.
- Query 2 returns 0 rows → the endpoint definitions were never loaded into the Quality database, and they must be seeded/imported.
- Query 5 shows no user or `has_sap_profile = false` → login is not persisting the session/profile, which also breaks every admin screen.

## Step 2 — Token check (run on the app server)

```bash
# what the app server thinks the backend URL is
grep -E 'SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY|VITE_SUPABASE' \
  /data/webapplication/resl_approval/Quality/frontend/dist/.env.runtime | cut -c1-60

# is that backend URL reachable from the app server?
curl -s -o /dev/null -w '%{http_code}\n' "$SUPABASE_URL/auth/v1/health"
```

An earlier screenshot showed port 8000 refusing connections, so this check matters: if the gateway is down or the URL/key on the app server does not match the running backend, the server cannot validate the login token and every admin screen shows `Unauthorized: Invalid token` even with a full database.

## Step 3 — After the results

Depending on the output, the follow-up work is one of:
- **Token/env mismatch**: correct the backend URL/keys in the app server env, restart it, and re-verify one admin screen.
- **Empty `sap_api_configs`**: prepare a re-runnable seed script (like `scripts/quality-sap-config.sql`) containing the endpoint definitions the app looks up by name, so SAP API Settings and Users & Roles have their endpoints.
- **Missing profile/permissions**: fix the login persistence path so `profiles.sap_profile` is written for the signed-in user.

No application code is changed in this step — first we confirm which of the two causes is real.
