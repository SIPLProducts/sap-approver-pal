# Fix login on the Quality server: app-server env + Login_API rows

Two separate problems are visible in your screenshot.

## 1. The red banner is an environment problem, not a database one

"Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY" comes from the app server on port 8080. Login runs there and it reads the database with the service-role key. Until those two variables exist in the app server's runtime environment, no SQL will help — the handler fails before it ever reads the config.

In `dist/.env.runtime` on the server (then restart the app-server process):

```
SUPABASE_URL=http://10.150.150.130:8000
SUPABASE_PUBLISHABLE_KEY=<your local anon key>
SUPABASE_SERVICE_ROLE_KEY=<your local service_role key from supabase/.env>
MIDDLEWARE_SHARED_SECRET=<same value as middleware/.env>
```

Both keys are in the self-hosted `supabase/.env` file on that box (`ANON_KEY`, `SERVICE_ROLE_KEY`). `VITE_*` values are browser-side only and do not satisfy this check.

## 2. The SQL to point login at your SAP URL

Login resolves in this order:
- if `sap_global_settings.middleware_url` is set → app server calls `{middleware_url}/login/Login_API`, and the middleware reads the `Login_API` row for the real SAP URL;
- otherwise the app server calls `sap_api_configs.endpoint_url` directly.

Run this in your server's Supabase SQL editor (Studio on port 3000). It creates or updates both rows.

```sql
-- SAP API row used for login
insert into public.sap_api_configs
  (name, description, module, endpoint_url, http_method, auth_type, api_type, is_active)
values
  ('Login_API', 'SAP login', 'COMMON',
   'http://10.150.150.155:8005/sd_approval_mng/login/login?sap-client=300',
   'POST', 'basic', 'fetch', true)
on conflict (name) do update set
  endpoint_url = excluded.endpoint_url,
  http_method  = excluded.http_method,
  auth_type    = excluded.auth_type,
  module       = excluded.module,
  api_type     = excluded.api_type,
  is_active    = true;

-- Middleware + SAP basic-auth user
insert into public.sap_global_settings
  (id, connection_mode, deployment_mode, middleware_port, middleware_url,
   sap_environment, sap_base_url, sap_username)
values
  ('default', 'via_proxy', 'self_hosted', 3002, 'http://127.0.0.1:3002',
   'quality', 'http://10.150.150.155:8005', 'SHARVI_INFO')
on conflict (id) do update set
  connection_mode = excluded.connection_mode,
  deployment_mode = excluded.deployment_mode,
  middleware_port = excluded.middleware_port,
  middleware_url = excluded.middleware_url,
  sap_base_url   = excluded.sap_base_url,
  sap_username   = excluded.sap_username;

-- SAP password + shared secret (service-role only table)
insert into public.sap_global_secrets (id, sap_password, proxy_secret)
values ('default', 'S!PI@2026', '<same MIDDLEWARE_SHARED_SECRET value>')
on conflict (id) do update set
  sap_password = excluded.sap_password,
  proxy_secret = excluded.proxy_secret;
```

Allowed values (enforced by the database — this is what your error was about):
- `connection_mode`: `direct` or `via_proxy` (not `middleware`)
- `deployment_mode`: `lovable_cloud` or `self_hosted` (not `on_prem`)
- `sap_api_configs.module`: `MM`, `SD`, `COMMON`; `auth_type`: `basic`, `oauth`, `none`, `proxy`; `api_type`: `sync`, `fetch`


To go direct to SAP without the middleware, set `middleware_url = null` instead — then the app server uses `endpoint_url` plus the basic-auth user/password above.

## Verify

```bash
psql -c "select name, endpoint_url, is_active from sap_api_configs where name='Login_API'"
curl -i -X POST http://127.0.0.1:3002/login/Login_API \
  -H 'content-type: application/json' -H 'x-shared-secret: <secret>' \
  -d '{"inputs":{"LOGIN":{"USER":"22011840","PASSWORD":"12345678"}}}'
```

Then sign in at `http://10.150.150.130:8081/login`. The banner must be gone first; if it still shows, the app server did not pick up `.env.runtime`.

## Code changes

None required — this is server configuration and data. If you want, I can also make the login screen show a clearer "backend not configured" message instead of the raw environment error.
