# Why the login request stays "pending", and what Quality's database needs

## Why `/_serverFn/...` never finishes

That URL is the login server function. It is not a static page — it runs on the app server (port 8080) and does real work before answering. Confirmed from the login code, it does this in order:

1. Opens a privileged database client (needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`).
2. Reads the `Login_API` row from `sap_api_configs` (must exist and be active).
3. Reads `sap_global_settings` and `sap_global_secrets` to find the middleware URL and shared secret.
4. Calls the middleware, which calls SAP.
5. Creates a backend auth user/session and writes the profile.

The request hangs instead of erroring because of steps 1 and 4:

- The privileged client is created with `SUPABASE_SERVICE_ROLE_KEY`. The value currently in your `.env` decodes to `"role":"anon"`, so it is not a service-role key. Admin calls made in step 5 (`auth.admin.listUsers`, `createUser`, `generateLink`) are refused with that key.
- The outbound call to the middleware in step 4 has no timeout in this path, so if the middleware or SAP does not answer, the browser request simply sits in "pending" until the proxy gives up rather than showing a message.

So "pending" is the visible symptom; the causes are the wrong service-role key plus the empty configuration rows below.

## What must exist in the Quality database

All four are currently empty, and login cannot work without them.

1. `sap_api_configs` — one active row named exactly `Login_API`, method `POST`, pointing at your SAP login endpoint:
   `http://10.150.150.155:8005/sd_approval_mng/login/login?sap-client=300`
2. `sap_global_settings` (id `default`) — `middleware_url` = `http://127.0.0.1:3002`, plus the SAP base URL and SAP username. `connection_mode` must be `via_proxy` and `deployment_mode` must be `self_hosted` to satisfy the table's check constraints.
3. `sap_global_secrets` (id `default`) — `proxy_secret` = the same value as `MIDDLEWARE_SHARED_SECRET` in `middleware/.env`, and `sap_password` for SAP Basic authentication.
4. `sap_api_credentials` — only needed if that API requires extra headers; optional otherwise.

Note the login row is looked up by the exact name `Login_API`. A different name, or `is_active` set to false, produces "Login_API is not configured".

## Implementation

1. Write one seed migration that inserts/updates those rows for the Quality environment, using values that satisfy the existing check constraints, and is safe to re-run.
2. Update the generated `dist/start.mjs` launcher to explicitly expose the server variables to the local runtime, and to refuse to start when `SUPABASE_SERVICE_ROLE_KEY` is not actually a service-role key — with names only in the log, never key material.
3. Add a request timeout to the middleware call in the login path, so a silent middleware returns a clear message instead of a pending request.
4. Fix the environment file: `SUPABASE_SERVICE_ROLE_KEY` must be the real service-role value from the self-hosted stack:

```bash
grep -E '^(ANON_KEY|SERVICE_ROLE_KEY)=' /data/webapplication/resl_approval/Quality/supabase/.env
```

Everything else you pasted is correct: both URLs, both publishable/anon keys, `VITE_SUPABASE_PROJECT_ID`, `MIDDLEWARE_URL`, and `MIDDLEWARE_SHARED_SECRET=123456` (valid only if identical to `middleware/.env`). Rotate the keys pasted in chat once login works.

## Deployment and verification

Build locally, copy `dist/` to the server, then:

```bash
cd /data/webapplication/resl_approval/Quality/frontend/dist
npm install --omit=dev --prefix .runtime
pm2 restart Qty_App --update-env
pm2 logs Qty_App --lines 50 --nostream
```

Then confirm the rows and the hop that was hanging:

```bash
docker exec -i supabase-db psql -U postgres -c \
  "select name, endpoint_url, is_active from sap_api_configs where name='Login_API';"

curl -i -X POST http://127.0.0.1:3002/login/Login_API \
  -H 'content-type: application/json' -H 'x-shared-secret: 123456' \
  -d '{"inputs":{"LOGIN":{"USER":"22011840","PASSWORD":"12345678"}}}'
```

Expected: one active `Login_API` row, the middleware returning the SAP user JSON, and the login request in the browser completing with a result instead of staying pending.
