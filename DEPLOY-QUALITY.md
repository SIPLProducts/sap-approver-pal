# Quality deployment (10.150.150.130)

## 1. Build (any machine with Node 20+)

```bash
npm ci
npm run build:selfhost
```

Use `build:selfhost` for this server. It builds the app server as a **plain Node
HTTP server** (`dist/server/index.mjs`) instead of a Cloudflare worker bundle —
no wrangler, no `workerd` binary, no `.runtime` install, and `process.env` is
visible to server code (which the SAP middleware callback needs).

Output — a single, clean `dist/` folder. No `.output/`, no `.wrangler/`, no duplicate
`dist/client/`; the build removes them itself. `dist/` is the only artefact you copy
to the server.

```text
dist/
  assets/                 <- hashed JS/CSS
  favicon.png
  manifest.webmanifest
  sw.js
  _headers
  build-info.json         <- build mode + fingerprint (the deploy helper checks it)
  server/                 <- app server bundle (SSR + all server functions)
  start.mjs               <- Node HTTP server: loads .env.runtime, serves dist/, calls server/
  .env.runtime            <- generated from frontend/.env (server-side keys)
  ecosystem.config.cjs    <- pm2 config (name Qty_App, port 8080)
  deploy-frontend.sh      <- one-command bring-up + checks
```

> There is **no static `index.html`** in a self-host build, and that is deliberate.
> A static shell is produced by a different Vite pass than `assets/`, so its hashed
> `<script>` names do not exist in the final `assets/` folder — that combination is
> exactly what causes "404 on every `/assets/*.js`" in the browser. The app server
> renders the HTML, so nginx must proxy `location /` to 8080 (see §5) instead of
> using `try_files ... /index.html`.
>
> `dist/server` must run: SAP login, PR/PO/ZNFA release, MIGO, user management,
> e-mail and push are server functions at `/_serverFn/*` (plus `/api/*`).

The build fails instead of emitting a mixed folder: after collecting `dist/` it runs
`npm run verify:dist`, which checks that the folder is complete (`start.mjs`,
`build-info.json`, `deploy-frontend.sh`, `server/index.mjs`), is in the right mode,
carries no stale root `index.html`, and that every `/assets/...` file referenced by
shipped HTML exists. You can re-run that check at any time:

```bash
npm run verify:dist
```

## 2. Ship and run

**Preferred — one verified archive.** This is the only way that cannot leave a
half-copied folder behind:

```bash
# build machine
npm run package:dist          # verifies dist/, then writes quality-frontend-dist.tar.gz
scp quality-frontend-dist.tar.gz root@10.150.150.130:/data/webapplication/resl_approval/Quality/frontend/

# server
cd /data/webapplication/resl_approval/Quality/frontend
mv dist "dist-broken-$(date +%Y%m%d-%H%M%S)"     # keep the old one, don't merge into it
mkdir dist && tar -xzf quality-frontend-dist.tar.gz -C dist
cd dist && bash deploy-frontend.sh
```

Alternative, if you have `rsync`:

```bash
# --delete is required, never merge into an old dist/
rsync -a --delete dist/ root@10.150.150.130:/data/webapplication/resl_approval/Quality/frontend/dist/
```

Never hand-pick files or subfolders in WinSCP, and never rename an older
`dist_…` folder into place. Without `--delete` (or a fresh empty folder), stale
chunks from an older build stay behind and the browser keeps requesting files that
no longer match this build.




`deploy-frontend.sh` regenerates `.env.runtime` from `frontend/.env`, verifies the
required keys, starts/restarts pm2 `Qty_App` on 8080, and runs the checks. It never
touches the SAP middleware on 3002.

Manual equivalent:

```bash
cd /data/webapplication/resl_approval/Quality/frontend/dist
pm2 start ecosystem.config.cjs      # or: pm2 restart Qty_App --update-env
pm2 save && pm2 startup             # reboot persistence
systemctl enable nginx
```

Required in `frontend/.env` (baked into `dist/.env.runtime` at build time):

```ini
SUPABASE_URL=http://10.150.150.130:8000
SUPABASE_PUBLISHABLE_KEY=<ANON_KEY from backend/.env>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from backend/.env — NOT the anon key>
MIDDLEWARE_URL=http://127.0.0.1:3002
MIDDLEWARE_SHARED_SECRET=<exact value from middleware/.env>
```

The launcher decodes `SUPABASE_SERVICE_ROLE_KEY` and prints
`warning: ... holds a 'anon' key` when the wrong key is used — sessions cannot be
created in that state.

Verify:

```bash
curl -I http://10.150.150.130:8081/                                  # frontend 200
ss -lntp | grep ':8080'                                              # node listening
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  http://127.0.0.1:8080/api/public/middleware/config                 # 401 = alive
curl -s http://127.0.0.1:3002/__health                               # middleware OK
```


systemd alternative — `/etc/systemd/system/resl-app-quality.service`:

```ini
[Unit]
Description=RESL Approval App (Quality)
After=network.target

[Service]
WorkingDirectory=/data/webapplication/resl_approval/Quality/frontend
Environment=PORT=8080
Environment=HOST=127.0.0.1
ExecStart=/usr/bin/npm start
Restart=always

[Install]
WantedBy=multi-user.target
```

## 3. Nginx (listens on 8081)

```nginx
server {
    listen 8081;
    server_name 10.150.150.130;

    client_max_body_size 50m;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;

    # No `root`/`index` here: the app server renders the HTML and serves
    # /assets/ itself with immutable caching. Serving a stale static index.html
    # from disk is what produced the "404 on every /assets/*.js" failure.



    # server functions + API routes -> app server (SAP, login, e-mail, push)
    location /_serverFn/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_read_timeout 300s;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_read_timeout 300s;
    }

    # middleware (SAP proxy)
    location /mw/ {
        proxy_pass http://127.0.0.1:3002/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    # Supabase API gateway (Kong)
    location /supabase/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Supabase Studio
    location /studio/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # everything else (pages + /assets/) -> app server on 8080
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_read_timeout 300s;
    }


}
```

Reload: `nginx -t && systemctl reload nginx`

## 3b. SAP API Settings — one script for everything

SAP API Settings live in the database, not in the frontend build, so a new
frontend deployment never carries them across. If endpoints are missing on the
server, run this single script:

```bash
# From the project root folder:
ls -lh scripts/sync-sap-config.sql
docker exec -i supabase-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres < scripts/sync-sap-config.sql

# OR, if you are already inside the scripts folder:
ls -lh sync-sap-config.sql
docker exec -i supabase-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres < sync-sap-config.sql
```

It installs/refreshes every endpoint, all request and response field mappings,
tenants, custom roles, role permissions and approval strategies in one
transaction. It is idempotent: endpoints are matched by name, and role
permissions are matched by role + screen + action, so it is safe to re-run after
every release. It deliberately does NOT touch the middleware URL, proxy secret,
SAP base URL or SAP credentials — Quality connection settings stay as they are.

Use `-v ON_ERROR_STOP=1`; if anything fails, psql stops at the first real SQL
error instead of continuing with repeated transaction-aborted messages.

If you previously saw `role_permissions_custom_uq` or
`role_permissions_builtin_uq`, copy the latest regenerated
`scripts/sync-sap-config.sql` to the server and rerun the same command above.
That duplicate-permission case is handled by this script version.

The script ends with two checks: row counts, then a list of endpoints that are
still `MISSING` or `INACTIVE`. An empty second result means nothing is missing.

Regenerate it from the reference environment (where the APIs are correct):

```bash
python3 scripts/generate-sap-sync.py     # writes scripts/sync-sap-config.sql
```

## 4. App URLs

| What | URL |
|---|---|
| Application | http://10.150.150.130:8081/ |
| Middleware | http://10.150.150.130:8081/mw/ |
| Supabase API | http://10.150.150.130:8081/supabase/ |
| Supabase Studio | http://10.150.150.130:8081/studio/ |

In **SAP API Settings**, keep "Via Proxy" enabled and set the middleware URL to
`http://10.150.150.130:3002` (or `http://10.150.150.130:8081/mw`).

## 5. Troubleshooting

### How to tell which of the two faults you have

```bash
curl -I http://127.0.0.1:8080/login    # the app server
curl -I http://127.0.0.1:8081/login    # what the browser gets (nginx)
```

| What you see on 8081 | Meaning |
| --- | --- |
| `ETag:` / `Last-Modified:` / fixed `Content-Length` | nginx served a **static file** from disk — it is not proxying. Fix §3. |
| no `ETag`, no `Last-Modified` | nginx is proxying correctly. |

| What you see on 8080 | Meaning |
| --- | --- |
| `500` | the app server runs but **throws while rendering**. Not a missing file — read `pm2 logs Qty_App --lines 80 --nostream`. Usually a value missing or wrong in `dist/.env.runtime` (step 3 of the deploy helper). |
| `200` | the app server is healthy; any remaining problem is nginx or browser cache. |

After any fix, test in a private/incognito window — the old service worker (`sw.js`)
and HTTP cache will otherwise keep replaying the broken page.

### The browser 404s on `/assets/*.js`

The deployed folder is a mix of two builds, or nginx is still serving an old
static `index.html`. Rebuild and replace the folder as one unit:

```bash
# build machine
rm -rf dist .output .wrangler && npm run build:selfhost && npm run package:dist
```

Then ship the archive as in §2 and confirm nginx has
`location / { proxy_pass http://127.0.0.1:8080; }` (§3) and no
`try_files ... /index.html`. `bash deploy-frontend.sh` now fails up front on a
stale root `index.html`, a missing `build-info.json`, dangling asset references,
a `/login` that returns 500, and an nginx that serves `/login` statically —
instead of letting any of them reach the browser.


### Nothing answers on port 8080

```bash
cd /data/webapplication/resl_approval/Quality/frontend/dist
pm2 logs Qty_App --lines 40 --nostream
node start.mjs            # run in the foreground to see the real error
```

A healthy start prints `[start] listening on http://127.0.0.1:8080` — that line
comes from the listen callback only, so if it is absent the port really is closed.
`[start] cannot bind …` means the port is taken (`ss -ltnp | grep 8080`);
`[start] server/index.mjs does not export a fetch handler` means the folder was
built with `npm run build` instead of `npm run build:selfhost`.

### Gateway (port 8000) crash-loops: "uniqueness violation: 'keyauth_credentials'"

Kong was handed the same API key twice. Clear the duplicates and recreate it:

```bash
cd /data/webapplication/resl_approval/Quality/backend
# these four must be EMPTY on a legacy-key install
grep -nE '^(ANON_KEY_ASYMMETRIC|SERVICE_ROLE_KEY_ASYMMETRIC|SUPABASE_PUBLISHABLE_KEY|SUPABASE_SECRET_KEY)=' .env

# inherited shell variables override .env — clear them in this shell first
unset ANON_KEY_ASYMMETRIC SERVICE_ROLE_KEY_ASYMMETRIC SUPABASE_PUBLISHABLE_KEY SUPABASE_SECRET_KEY

docker compose --env-file .env -p resl_quality up -d --force-recreate kong
docker logs --tail 30 supabase-kong
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/auth/v1/health   # expect 200
```

The Kong entrypoint also drops duplicate credentials itself now, so a mis-set
variable degrades to legacy-key mode instead of taking the gateway down.

