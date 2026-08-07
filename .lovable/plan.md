# Quality server: exact next steps after creating the database

The database is now created correctly. The migration output completed without
an error, `\dt` shows all 26 application tables, and the REST test returned
`HTTP 200 []`. An empty array is expected because no users exist yet.

Two deployment items remain:

1. Port 8000 is intentionally bound to `127.0.0.1`, so a browser cannot open
   `http://10.150.150.130:8000`. Browser traffic must use Nginx at
   `http://10.150.150.130:8081/supabase`.
2. The 502 proves that the application server is not listening on port 8080.

## 1. What "the app server on 8080" is

Your deployment has three app processes, not one:

| Process | Port | What it is | Running? |
| --- | --- | --- | --- |
| Nginx | 8081 | serves `dist/` + proxies | yes |
| SAP middleware (`middleware/server.js`) | 3002 | talks to SAP | yes (`Qty_Approval`) |
| **App server (`npm start` in `frontend/`)** | **8080** | runs every `/_serverFn/*` and `/api/*` — SAP login, PR/PO/ZNFA, MIGO, users, mail, push | **NO — this is the 502** |
| Supabase stack (Kong) | 8000 (localhost only) | auth + database | **healthy and schema created** |

The static `dist/` files cannot call SAP or create a session by themselves. The
browser posts to `/_serverFn/<hash>`; Nginx forwards that to `127.0.0.1:8080`;
nothing listens there, so Nginx answers **502 Bad Gateway** — exactly the popup
in your screenshot.

### Start it first in the foreground

```bash
cd /data/webapplication/resl_approval/Quality/frontend
ls dist/server/index.mjs        # must exist (from npm run build)
ls -d node_modules/wrangler     # if missing: npm ci
PORT=8080 HOST=127.0.0.1 npm start
```

Expect `[start] serving dist/ on http://127.0.0.1:8080`. Leave that terminal
open and test from a second terminal:

```bash
ss -ltnp | grep 8080
curl -i -X POST http://127.0.0.1:8080/_serverFn/ping
curl -i -X POST http://10.150.150.130:8081/_serverFn/ping
```

A 404/400/500 from the dummy `ping` path is acceptable; **502 is not**. It only
tests whether Nginx can reach the app server. Then stop the foreground process
with Ctrl+C and run it under pm2 as a **second** process:

```js
// /data/webapplication/resl_approval/Quality/frontend/ecosystem.config.cjs
module.exports = {
  apps: [{
    name: "Qty-App",
    cwd: "/data/webapplication/resl_approval/Quality/frontend",
    script: "npm",
    args: "start",
    autorestart: true,
    env: {
      PORT: "8080",
      HOST: "127.0.0.1",
      NODE_ENV: "production",
      SUPABASE_URL: "http://127.0.0.1:8000",
      SUPABASE_PUBLISHABLE_KEY: "<ANON_KEY from backend/.env>",
      SUPABASE_SERVICE_ROLE_KEY: "<SERVICE_ROLE_KEY from backend/.env>",
    },
  }],
};
```

```bash
pm2 start ecosystem.config.cjs && pm2 save
pm2 ls                       # must now show Qty_Approval AND Qty-App
pm2 logs Qty-App --lines 50
```

The **service role key is mandatory** — SAP login uses it to create the user and
mint the one-time login token. Without it login fails even when SAP accepts the
password.

## 2. Use the correct browser backend URL

The Docker configuration binds Kong as:

```text
127.0.0.1:8000 -> container:8000
```

This is secure and should remain unchanged. It explains why `curl
127.0.0.1:8000` works on the server but `10.150.150.130:8000` is refused from a
user PC. Do **not** expose port 8000 publicly; your Nginx `/supabase/` block
already supplies the public route.

Rebuild the app using this frontend environment:

```text
VITE_SUPABASE_PROJECT_ID=Quality
VITE_SUPABASE_URL=http://10.150.150.130:8081/supabase
VITE_SUPABASE_PUBLISHABLE_KEY=<exact ANON_KEY from backend/.env>
```

Then:

```bash
cd /data/webapplication/resl_approval/Quality/frontend
npm ci
rm -rf dist
npm run build
ls dist/index.html dist/server/index.mjs
```

The runtime app server still uses the private local URL:

```text
SUPABASE_URL=http://127.0.0.1:8000
```

Test the browser-facing Nginx route from any user PC or the server:

```bash
curl -i http://10.150.150.130:8081/supabase/auth/v1/health \
  -H "apikey: <ANON_KEY>"
```

`200` confirms the route. Opening the bare API URL in Chrome is not a useful UI
test; Supabase Studio is at `http://10.150.150.130:8081/studio/`.

Key rules:

- `JWT_SECRET`, `ANON_KEY` and `SERVICE_ROLE_KEY` in `backend/.env` must be
  consistent with each other (the two keys are JWTs signed with that secret).
- `VITE_SUPABASE_PUBLISHABLE_KEY` in the frontend build must be **byte
  identical** to `ANON_KEY`, or every browser call fails with an invalid JWT.
- Never delete `volumes/db/data` — that is the live database.

## 3. Seed Login_API before the first login

The migrations created the SAP settings tables and default global rows, but
they do **not** insert a `Login_API` configuration. This creates a first-login
dependency: SAP login checks that row before it can create the first admin.

Best option: restore/copy the existing `sap_api_configs` and related
configuration rows from your Quality backup or existing environment. If no
backup row is available, insert a minimal active row on the server (adjust the
endpoint URL to the SAP login endpoint expected by your middleware):

```bash
cd /data/webapplication/resl_approval/Quality/backend
docker compose -p resl_quality exec -T db psql -U postgres -d postgres <<'SQL'
INSERT INTO public.sap_api_configs
  (name, description, module, endpoint_url, http_method, auth_type, api_type,
   auto_sync_enabled, is_active)
VALUES
  ('Login_API', 'SAP user login', 'AUTH', '/login', 'POST', 'none', 'Login',
   false, true)
ON CONFLICT (name) DO UPDATE SET is_active = true;
SQL
```

The middleware path actually called by this app is
`http://127.0.0.1:3002/login/Login_API`; the config row must exist and be active
even in proxy mode.

Configure the existing default global rows directly before login, or restore
them from backup:

```bash
docker compose -p resl_quality exec -T db psql -U postgres -d postgres <<'SQL'
UPDATE public.sap_global_settings
SET connection_mode = 'proxy',
    middleware_url = 'http://127.0.0.1:3002',
    sap_base_url = 'http://10.150.150.155:8005'
WHERE id = 'default';

UPDATE public.sap_global_secrets
SET proxy_secret = '<same strong value as middleware MIDDLEWARE_SHARED_SECRET>'
WHERE id = 'default';
SQL
```

Use the exact connection-mode value already present in your previous database
if it differs from `proxy`; restoring these rows from the backup is safer than
guessing custom configuration.

## 4. First login and admin creation

1. Open `http://10.150.150.130:8081/login` and sign in with a valid SAP user.
   The app creates the backend user on the fly, and the existing
   `handle_new_user` trigger gives the **first** user the Admin role.
2. As that admin, open **SAP API Settings → Global settings** and set:
   - Connection Mode: Via Proxy (middleware)
   - Middleware URL: `http://127.0.0.1:3002` (server-side call) or
     `http://10.150.150.130:8081/mw`
   - Proxy secret = `MIDDLEWARE_SHARED_SECRET` in the middleware `.env`
   - SAP Base URL: `http://10.150.150.155:8005`
   - press "Test connection" (hits `{middleware}/__health`)
3. Confirm an **active** API config named exactly `Login_API` exists — otherwise
   login returns "Login_API is not configured in SAP API Settings".

Note: your middleware log shows `app: http://10.150.150.130:8081` — correct. The
earlier line pointing at `http://10.150.150.155:8005` was an older build.

## 5. Full login flow on the server

```text
browser :8081  →  Nginx  →  /_serverFn/*  →  app server :8080
                                              → middleware :3002 → SAP (validates password)
                                              → Supabase :8000  (creates user, mints token)
browser  →  Supabase :8000 verifyOtp  →  session  →  app opens
```

So SAP is the only password authority, and Supabase is required for the session,
profile, roles and RLS data. Nothing works until **both** :8080 and the
:8000 schema are in place.

## 6. Order of operations

1. Keep the successful database/schema as-is; do not rerun migrations.
2. Rebuild with `VITE_SUPABASE_URL=http://10.150.150.130:8081/supabase`.
3. Seed/restore `Login_API` and SAP global settings.
4. Start `Qty-App` on 8080 with the three runtime Supabase variables.
5. Confirm `pm2 ls` shows both processes and `/ping` no longer returns 502.
6. Log in with a valid SAP user; the first user becomes Admin.

## Notes

- No app code changes are needed for any of this — it is purely server setup.
- If you want, I can add sections 1-4 as a checklist inside `DEPLOY-QUALITY.md`
  so it lives with the repo.
