# Quality server: restore frontend and backend access

## Diagnosis from your latest output: only port 8080 is missing

Your results prove the infrastructure is already correct. Nothing in Nginx, the
build, Kong or Studio needs to be changed:

| Check | Result | Verdict |
| --- | --- | --- |
| `nginx -t` | syntax ok, test successful | correct |
| `systemctl status nginx` | active (running), reloaded 09:34 | correct |
| `ss -ltnp` | 8081 nginx, 8000 Kong, 3000 Studio, 3002 middleware | correct |
| `curl :8081/login` | **HTTP 200**, 4113 bytes | frontend is served |
| `curl :8000/auth/v1/health` | 401 `No API key found`, `Server: kong` | Kong alive |
| `curl :8081/supabase/auth/v1/health` | 401 from Kong via `Server: nginx` | proxy route works |
| `curl :3000/` | 307 -> `/project/default` | Studio alive |
| `:8080` in `ss` output | **absent** | **the only failure** |

Two results that look like errors but are not:

- `401 {"message":"No API key found in request"}` is Kong correctly rejecting a
  request without an `apikey` header. It proves the backend is reachable. Add
  `-H "apikey: $ANON_KEY"` to see `200`.
- `sudo: unable to load libsss_sudo.so` is unrelated to this app. You are already
  `root`, so drop the `sudo` prefix from these commands.

So the frontend problem is not Nginx: `/login` returns 200, the shell loads, and
it then fails on its first server call. Your error log confirms it — every line
is the same fault:

```text
connect() failed (111: Connection refused) ... upstream: "http://127.0.0.1:8080/_serverFn/..."
```

The application server on 8080 has never been started. The older lines pointing
at `127.0.0.1:8082` predate the current config and can be ignored.

Fix it with section 1 below; nothing else in this deployment needs action.

### What to do now (next 30 minutes)

1. Start the app server on port 8080 (section 1).
2. Insert the `Login_API` config row (section 4).
3. Rebuild the frontend with `VITE_SUPABASE_URL=http://10.150.150.130:8081/supabase` (section 3).

Then test the login. Everything else is already working.

### What your two screenshots show

1. **Login page + `502` on Sign in.** The page itself loaded from Nginx, so the
   frontend is deployed correctly. Pressing Sign in posts to
   `/_serverFn/14406b97...`, Nginx forwards it to `127.0.0.1:8080`, nothing is
   listening, and Nginx returns its own `502 Bad Gateway` HTML — which the app
   then displays in that red toast. This is the same missing 8080 process, not a
   login bug and not an SAP problem.
2. **`10.150.150.130:8000` → `ERR_CONNECTION_REFUSED`.** This is expected and
   correct. Kong is deliberately bound to `127.0.0.1:8000`, so it is only
   reachable from the server itself. Nothing is broken here.

"Supabase not opening" is a misunderstanding of what runs on 8000. It is an
HTTP API, not a website — opening it in a browser is never the right test, and
you already proved it is healthy (`Server: kong/3.9.3` with a `401` for a missing
API key). Use these instead:

- Admin UI: `http://10.150.150.130:8081/studio/` (Studio, behind basic auth).
- API through Nginx: `http://10.150.150.130:8081/supabase/...` — the browser must
  use this path, never port 8000.
- Verify with a key: `curl -i http://10.150.150.130:8081/supabase/auth/v1/health -H "apikey: $ANON_KEY"` → `200`.

Do not open port 8000 to the network to "fix" this.

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
