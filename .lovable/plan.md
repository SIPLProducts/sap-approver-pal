# Quality server: restore frontend and backend access

## Immediate diagnosis for the current outage

The pasted Nginx routing is structurally correct for this deployment, but
"frontend not coming" does not identify whether Nginx failed to reload, the
static build is absent, or an upstream is down. Do not edit the configuration
again until these checks identify the failing layer.

Run on the Ubuntu server, in this order:

```bash
# 1. Validate Nginx and confirm port 8081 is listening
sudo nginx -t
sudo systemctl status nginx --no-pager -l
sudo ss -ltnp | grep -E ':8081|:8080|:8000|:3000|:3002'

# 2. Confirm the frontend shell and assets exist where Nginx expects them
sudo ls -lh /data/webapplication/resl_approval/Quality/frontend/dist/index.html
sudo ls -ld /data/webapplication/resl_approval/Quality/frontend/dist/assets
sudo -u www-data test -r /data/webapplication/resl_approval/Quality/frontend/dist/index.html \
  && echo 'frontend readable' || echo 'frontend missing/not readable'

# 3. Test each layer locally, bypassing the browser
curl -i http://127.0.0.1:8081/login
curl -i http://127.0.0.1:8000/auth/v1/health
curl -i http://127.0.0.1:8081/supabase/auth/v1/health
curl -i http://127.0.0.1:3000/

# 4. Read the actual Nginx failure, if any
sudo tail -n 100 /data/webapplication/resl_approval/Quality/logs/error.log
sudo journalctl -u nginx -n 100 --no-pager
```

Interpret the results as follows:

- `nginx -t` fails: fix the exact file/line reported, then run
  `sudo systemctl reload nginx`.
- Nothing listens on `:8081`: Nginx did not start or this server block is not
  enabled. Confirm the file is linked under `/etc/nginx/sites-enabled/`, retest,
  and restart Nginx.
- `/login` returns `404` or the `ls` command fails: deploy the complete `dist/`
  output to the configured root. The login page is served by `index.html`; it
  does not depend on port 8080 merely to render.
- `/login` returns `403`: make the parent directories traversable and the build
  readable by `www-data`:

  ```bash
  sudo chmod o+x /data /data/webapplication /data/webapplication/resl_approval \
    /data/webapplication/resl_approval/Quality \
    /data/webapplication/resl_approval/Quality/frontend
  sudo find /data/webapplication/resl_approval/Quality/frontend/dist \
    -type d -exec chmod 755 {} \;
  sudo find /data/webapplication/resl_approval/Quality/frontend/dist \
    -type f -exec chmod 644 {} \;
  ```
- Direct `:8000/auth/v1/health` works but the `/supabase/...` test fails: inspect
  the Nginx error log and ensure the active config contains the trailing slashes
  exactly as pasted: `location /supabase/` and
  `proxy_pass http://supabase_api/;`. This intentionally strips `/supabase/`
  before forwarding to Kong.
- Both backend health requests return `401` while the service answers: repeat
  with `-H "apikey: $ANON_KEY"` after loading `backend/.env`; an auth status is
  not the same as a connection refusal or 502.
- `/studio/` redirects or loads broken assets: Studio may not be subpath-aware.
  The application does not require Studio to log in; restore the app first, then
  expose Studio on a separate protected port/server name if its assets do not
  support `/studio/`.

After the static login page returns HTTP 200, restore port 8080 using section 1
below. Without the app server the page renders, but submitting SAP login returns
502.

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

### Deploy the runtime files, then start it in the foreground

Your `frontend/` folder currently contains `dist/`, but not `package.json` or
`node_modules`. This is why `npm start` fails with `ENOENT package.json`.
`dist/server/index.mjs` is the compiled application, but this project's start
command also requires the repository runtime files and Wrangler.

Copy these from the project/build machine to the server:

```bash
rsync -a package.json package-lock.json scripts/ \
  root@10.150.150.130:/data/webapplication/resl_approval/Quality/frontend/
rsync -a --delete dist/ \
  root@10.150.150.130:/data/webapplication/resl_approval/Quality/frontend/dist/
```

Then on the server:

```bash
cd /data/webapplication/resl_approval/Quality/frontend
ls package.json scripts/start-server.mjs dist/server/index.mjs
npm ci --include=dev            # installs Wrangler, which is a build/runtime dependency here
ls -d node_modules/wrangler
PORT=8080 HOST=127.0.0.1 npm start
```

Run these commands one at a time. Your latest output only shows the three test
commands; it does not show `npm start` being run. Therefore nothing is listening
on 8080 and the 502 is expected.

Expect `[start] serving dist/ on http://127.0.0.1:8080`. Leave that terminal
open and test from a second terminal:

```bash
ss -ltnp | grep 8080
curl -i -X POST http://127.0.0.1:8080/_serverFn/ping
curl -i -X POST http://10.150.150.130:8081/_serverFn/ping
```

A 404/400/500 from the dummy `ping` path is acceptable; **502 is not**. It only
tests whether Nginx can reach the app server. Then stop the foreground process
with Ctrl+C and run it under pm2 as a **second** process.

`ecosystem.config.cjs` is **not required**. It is only a convenient way to keep
all environment variables together. Your other project likely supplies its
environment another way. Use PM2 directly here:

```bash
cd /data/webapplication/resl_approval/Quality/frontend

# Load backend keys without printing them. Confirm these exact variable names
# exist first: ANON_KEY and SERVICE_ROLE_KEY.
set -a
. /data/webapplication/resl_approval/Quality/backend/.env
set +a

PORT=8080 \
HOST=127.0.0.1 \
NODE_ENV=production \
SUPABASE_URL=http://127.0.0.1:8000 \
SUPABASE_PUBLISHABLE_KEY="$ANON_KEY" \
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
pm2 start npm --name Qty-App -- start

pm2 save
pm2 ls                       # must now show Qty_Approval AND Qty-App
pm2 logs Qty-App --lines 50
```

If PM2 does not preserve the shell variables after reboot, use a root-owned
environment file or an ecosystem file later. First make the direct command work.

The **service role key is mandatory** — SAP login uses it to create the user and
mint the one-time login token. Without it login fails even when SAP accepts the
password.

## 2. Supabase is already created

Do **not** recreate it and do not rerun the migrations. These results confirm a
successful backend:

- Docker containers are healthy.
- `\dt public.*` lists all 26 application tables.
- `/rest/v1/profiles` returned `HTTP 200 []`.

`[]` means the `profiles` table is empty, not that Supabase is missing. It will
receive its first row after the first successful SAP login.

Supabase is an API/database service, not a normal website on `/`. Its admin UI
is Studio at `http://10.150.150.130:8081/studio/` through Nginx.

## 3. Use the correct browser backend URL

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

## 4. Seed Login_API before the first login

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
  ('Login_API', 'SAP user login', 'COMMON', '/login', 'POST', 'none', 'fetch',
   false, true)
ON CONFLICT (name) DO UPDATE SET is_active = true;
SQL
```

Your previous insert was rolled back completely because `api_type='Login'` is
invalid. The schema permits only `sync` or `fetch`; it also permits only `MM`,
`SD`, or `COMMON` for `module`. The corrected statement above uses valid values.

The middleware path actually called by this app is
`http://127.0.0.1:3002/login/Login_API`; the config row must exist and be active
even in proxy mode.

Configure the existing default global rows directly before login, or restore
them from backup:

```bash
docker compose -p resl_quality exec -T db psql -U postgres -d postgres <<'SQL'
UPDATE public.sap_global_settings
SET connection_mode = 'via_proxy',
    middleware_url = 'http://127.0.0.1:3002',
    sap_base_url = 'http://10.150.150.155:8005'
WHERE id = 'default';

UPDATE public.sap_global_secrets
SET proxy_secret = '<same strong value as middleware MIDDLEWARE_SHARED_SECRET>'
WHERE id = 'default';
SQL
```

The application accepts `direct` or `via_proxy`; `via_proxy` is the correct
value for your Node.js middleware setup. Restoring API rows from your backup is
still preferable if it contains the exact production endpoint configuration.

## 5. First login and admin creation

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

## 6. Full login flow on the server

```text
browser :8081  →  Nginx  →  /_serverFn/*  →  app server :8080
                                              → middleware :3002 → SAP (validates password)
                                              → Supabase :8000  (creates user, mints token)
browser  →  Supabase :8000 verifyOtp  →  session  →  app opens
```

So SAP is the only password authority, and Supabase is required for the session,
profile, roles and RLS data. Nothing works until **both** :8080 and the
:8000 schema are in place.

## 7. Exact order from your current position

1. Keep the successful database/schema as-is; do not rerun migrations.
2. Copy `package.json`, `package-lock.json`, `scripts/`, and the whole `dist/`.
3. Run `npm ci --include=dev`; verify `node_modules/wrangler` exists.
4. Run `PORT=8080 HOST=127.0.0.1 npm start` in the foreground.
5. Only after foreground startup works, use the direct PM2 command above.
6. Confirm `pm2 ls` shows `Qty_Approval` and `Qty-App`, and use `ss -ltnp`
   (two letters `s`, not the mistyped `s -ltnp`) to verify 8080 is listening.
7. Rebuild with `VITE_SUPABASE_URL=http://10.150.150.130:8081/supabase` if the
   current build still contains `http://10.150.150.130:8000`.
8. Run the corrected `Login_API` insert and SAP global settings update.
9. Log in with a valid SAP user; the first user becomes Admin.

## Notes

- No app code changes are needed for any of this — it is purely server setup.
- If you want, I can add sections 1-4 as a checklist inside `DEPLOY-QUALITY.md`
  so it lives with the repo.
