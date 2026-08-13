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

Output — a single, clean `dist/` folder. No `.output/`, no `.wrangler/`. `dist/` is
the only artefact you copy to the server.

```text
dist/
  client/                 <- browser files: hashed JS/CSS in client/assets/,
  │                          favicon.png, manifest.webmanifest, sw.js
  server/                 <- app server bundle (SSR + all server functions)
  start.mjs               <- Node HTTP server: loads .env.runtime, serves client/, calls server/
  build-info.json         <- build mode + staticRoot (the deploy helper checks it)
  .env.runtime            <- generated from frontend/.env (server-side keys)
  ecosystem.config.cjs    <- pm2 config (name Qty_App, port 8080)
  deploy-frontend.sh      <- one-command bring-up + checks
  check-server-imports.mjs <- server bundle completeness check
```

> There is **no static `index.html`** in a self-host build, and that is deliberate.
> A static shell is produced by a different Vite pass than `assets/`, so its hashed
> `<script>` names do not exist in the final `client/assets/` folder — that combination is
> exactly what causes "404 on every `/assets/*.js`" in the browser. The app server
> renders the HTML and serves the assets, so nginx must proxy **all** of `/_serverFn/`,
> `/api/`, `/assets/`, `/sw.js`, `/manifest.webmanifest` and `/` to 8080 (see §5).
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

## 3. Nginx (listens on 8081, proxies to the app server on 8080)

Copy the maintained config file to the server and reload Nginx:

```bash
cp deploy/quality/nginx/resl-approval-quality-8081.conf \
   /etc/nginx/conf.d/resl-approval-quality-8081.conf
nginx -t && systemctl reload nginx
```

The config below is the same file. It intentionally has **no `root` directive** and
proxies every browser path — pages, `/_serverFn/`, `/api/`, `/assets/`, `/sw.js`, and
`/manifest.webmanifest` — to the app server on 8080. Nginx serving `/assets/` from
disk is the root cause of the unstyled login page and the `Failed to fetch dynamically
imported module` error.

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

upstream supabase_api    { server 127.0.0.1:8000; keepalive 16; }
upstream supabase_studio { server 127.0.0.1:3000; }
upstream middleware_api  { server 127.0.0.1:3002; keepalive 16; }
upstream app_server      { server 127.0.0.1:8080; keepalive 16; }

server {
    listen 8081;
    server_name 10.150.150.130;

    # No `root` directive. The app server renders every page and serves every
    # browser asset. Serving assets from disk would use a dist/assets/ path that
    # no longer exists in this self-host build.
    server_tokens off;
    client_max_body_size 50M;

    access_log /data/webapplication/resl_approval/Quality/logs/access.log;
    error_log  /data/webapplication/resl_approval/Quality/logs/error.log;

    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 5;
    gzip_types text/plain text/css application/json application/javascript image/svg+xml;

    # server functions + API routes -> app server (SAP, login, e-mail, push)
    location /_serverFn/ {
        proxy_pass http://app_server;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_connect_timeout 30s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_buffering off;
        proxy_request_buffering off;
    }

    location /api/ {
        proxy_pass http://app_server;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_connect_timeout 30s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # Supabase API gateway (Kong)
    location /supabase/ {
        proxy_pass http://supabase_api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_connect_timeout 30s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_buffering off;
    }

    # Supabase Studio (basic auth required)
    location /studio/ {
        auth_basic "RESL Quality Studio";
        auth_basic_user_file /etc/nginx/.htpasswd-studio;
        proxy_pass http://supabase_studio/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 300s;
    }

    # SAP middleware
    location /mw/ {
        proxy_pass http://middleware_api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection keep-alive;
        add_header X-Frame-Options SAMEORIGIN always;
        add_header X-Content-Type-Options nosniff always;
        add_header Referrer-Policy strict-origin-when-cross-origin always;
        add_header Cache-Control "no-store" always;
        proxy_connect_timeout 30s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        send_timeout 300s;
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # hashed build assets -> app server (never disk)
    location /assets/ {
        proxy_pass http://app_server;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_connect_timeout 30s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # service worker / manifest -> app server, never cache
    location = /sw.js {
        proxy_pass http://app_server;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        add_header Cache-Control "no-store" always;
    }
    location = /manifest.webmanifest {
        proxy_pass http://app_server;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        add_header Cache-Control "no-store" always;
    }

    # everything else (pages) -> app server on 8080
    location / {
        proxy_pass http://app_server;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_connect_timeout 30s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_buffering off;
    }
}
```

Reload: `nginx -t && systemctl reload nginx`

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

### The browser 404s on `/assets/*.js` or shows "Failed to fetch dynamically imported module"

The deployed folder is a mix of two builds, or nginx is still serving `/assets/`
from disk instead of proxying it to the app server. Rebuild and replace the folder
as one unit:

```bash
# build machine
rm -rf dist .output .wrangler && npm run build:selfhost && npm run package:dist
```

Then ship the archive as in §2 and confirm nginx has no `root` directive, no
`location /assets/` with `try_files`, and all of `/`, `/_serverFn/`, `/api/`,
`/assets/`, `/sw.js`, and `/manifest.webmanifest` are proxied to `127.0.0.1:8080`.

`bash deploy-frontend.sh` now fails up front on a stale root `index.html`, a
missing `build-info.json`, dangling asset references, a `/login` that returns 500,
and an nginx that serves `/login` or `/assets/*` statically — instead of letting
any of them reach the browser.


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

