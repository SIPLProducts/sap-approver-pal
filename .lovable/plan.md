# Restore the complete Quality login path

## Confirmed architecture

```text
Browser
  │ http://10.150.150.130:8081
  ▼
Nginx :8081
  ├─ /, /assets/*         → static files in frontend/dist
  ├─ /_serverFn/*, /api/* → Qty_App on 127.0.0.1:8080
  ├─ /supabase/*          → backend gateway on 127.0.0.1:8000
  ├─ /studio/*            → backend Studio on 127.0.0.1:3000
  └─ /mw/*                → Qty_Approval on 127.0.0.1:3002

Login request:
Browser → Nginx → Qty_App :8080 → Qty_Approval :3002 → SAP
                         │                 │
                         └──── backend ────┘
```

`Qty_Approval` is the existing Express SAP middleware and must remain on port `3002`.

`Qty_App` is intended to run `frontend/dist/start.mjs`. That launcher starts the built TanStack application server from `frontend/dist/server`; this is the process that must listen on `127.0.0.1:8080` and execute Login and the other server functions.

PM2 showing `Qty_App` as `online` does not prove it is healthy. The supplied `node --check start.mjs` output proves the currently deployed launcher cannot parse, so it is not providing a stable listener on port 8080. This is why Nginx returns 502 before the request reaches the working middleware.

The other application can work without this extra process only if it has a different, client-only architecture. In this application the browser deliberately does not call SAP or the middleware directly: the application server securely loads configuration, creates the authenticated backend session after SAP accepts the credentials, and keeps privileged keys out of the browser.

## 1. Inspect the two live PM2 processes before changing anything

Run these commands and retain the output as a deployment record:

```bash
pm2 describe Qty_Approval
pm2 describe Qty_App
pm2 pid Qty_Approval
pm2 pid Qty_App

APP_PID=$(pm2 pid Qty_App)
MW_PID=$(pm2 pid Qty_Approval)
test -n "$APP_PID" && readlink -f "/proc/$APP_PID/cwd"
test -n "$APP_PID" && tr '\0' ' ' < "/proc/$APP_PID/cmdline"; echo
test -n "$MW_PID" && readlink -f "/proc/$MW_PID/cwd"
test -n "$MW_PID" && tr '\0' ' ' < "/proc/$MW_PID/cmdline"; echo

ss -ltnp | grep -E ':(3002|8080|8081|8000|3000)\b' || true
curl -fsS http://127.0.0.1:3002/__health
curl -i http://127.0.0.1:8080/
```

Expected result:

- `Qty_Approval` command points to the middleware `server.js`; health returns JSON and port `3002` is listening.
- `Qty_App` command points to `frontend/dist/start.mjs`; port `8080` must be listening.
- Do not delete, restart, rename, or change `Qty_Approval` while repairing `Qty_App`.

## 2. Fix the generated application-server launcher

Correct `scripts/collect-dist.mjs` so the launcher template emits a literal regular expression rather than inserting carriage-return/newline characters into `start.mjs`:

```js
.split(/\\r?\\n/)
```

This is the source fix. Every future `npm run build` will then generate a valid self-contained `dist/start.mjs`.

After rebuilding on the development/build machine, verify the artifact before copying it:

```bash
npm run build
node --check dist/start.mjs
grep -n 'split' dist/start.mjs
ls -la dist/package.json dist/start.mjs dist/server/index.mjs dist/index.html
```

`node --check` must exit without an error. The emitted line must contain `.split(/\r?\n/)` on one line.

## 3. Build-time frontend backend URL

The browser-facing backend URL must use Nginx, not a loopback address and not a backend port that is bound only locally:

```ini
VITE_SUPABASE_URL=http://10.150.150.130:8081/supabase
VITE_SUPABASE_PUBLISHABLE_KEY=<Quality ANON_KEY>
```

These values must be present when `npm run build` runs because `VITE_*` values are compiled into the frontend assets.

## 4. Deploy only the newly verified `dist` folder

The source repository is not required on the Quality server. Preserve the old folder, copy the complete new `dist`, and install only its runtime dependency:

```bash
cd /data/webapplication/resl_approval/Quality/frontend
mv dist "dist_backup_$(date +%Y%m%d_%H%M%S)"
# Copy the newly built dist/ here as:
# /data/webapplication/resl_approval/Quality/frontend/dist

cd /data/webapplication/resl_approval/Quality/frontend/dist
npm install --omit=dev
node --check start.mjs
```

Do not run `npm install` in `frontend/`; run it inside `frontend/dist/`, where the generated `package.json` exists.

## 5. Application-server runtime environment

Create `/data/webapplication/resl_approval/Quality/frontend/dist/.env.runtime` with server-only Quality values:

```ini
PORT=8080
HOST=127.0.0.1
NODE_ENV=production
SUPABASE_URL=http://127.0.0.1:8000
SUPABASE_PUBLISHABLE_KEY=<Quality ANON_KEY>
SUPABASE_ANON_KEY=<Quality ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<Quality SERVICE_ROLE_KEY>
MIDDLEWARE_SHARED_SECRET=<exact secret already used by Qty_Approval>
```

Protect it:

```bash
chmod 600 /data/webapplication/resl_approval/Quality/frontend/dist/.env.runtime
```

The service-role value belongs only in `.env.runtime`; it must never be placed in a `VITE_*` variable, frontend asset, Nginx config, command history, or PM2 ecosystem file.

## 6. Exact PM2 startup

### Qty_Approval — preserve the working middleware

If it already passes `curl http://127.0.0.1:3002/__health`, leave it untouched. Its required runtime identity is:

```text
Name: Qty_Approval
Script: middleware/server.js
Working directory: the deployed middleware folder
PORT: 3002
```

Only if it ever needs to be recreated, run this from its real deployed folder (do not guess or change the current path):

```bash
cd <existing-middleware-directory>
npm install --omit=dev
PORT=3002 pm2 start server.js \
  --name Qty_Approval \
  --cwd <existing-middleware-directory> \
  --interpreter node
```

Its existing `.env` remains authoritative for the SAP URL, credentials/fallbacks, and shared secret. For a fully self-hosted Quality flow, `APP_BASE_URL` should resolve back to the local application server, preferably:

```ini
APP_BASE_URL=http://127.0.0.1:8080
```

Change only this value if the middleware health output/logs show that it is currently calling an incorrect or unavailable app host. The shared secret must exactly match `.env.runtime`.

### Qty_App — replace only the broken application process

```bash
pm2 delete Qty_App 2>/dev/null || true

pm2 start /data/webapplication/resl_approval/Quality/frontend/dist/start.mjs \
  --name Qty_App \
  --cwd /data/webapplication/resl_approval/Quality/frontend/dist \
  --interpreter node \
  --time

pm2 save
pm2 startup
```

Run the command printed by `pm2 startup` once if startup persistence has not already been configured.

Immediately validate the process rather than trusting the PM2 status label:

```bash
pm2 logs Qty_App --lines 80 --nostream
ss -ltnp | grep ':8080'
curl -i http://127.0.0.1:8080/
curl -i -X POST http://127.0.0.1:8080/api/public/middleware/config \
  -H 'content-type: application/json' \
  -d '{"name":"Login_API"}'
```

The last request should return `401 Invalid or missing x-shared-secret`. That 401 is a successful routing test: it proves the app API is alive and enforcing its secret. A connection refusal, 502, HTML response, or restart loop is not acceptable.

## 7. Nginx Quality server block

First capture the active configuration, because editing a different file has no effect:

```bash
sudo nginx -T > /tmp/nginx-effective.txt
grep -nE 'listen 8081|server_name|root |location /(_serverFn|api|mw|supabase|studio)' /tmp/nginx-effective.txt
```

The active Quality `server` block should contain these routes:

```nginx
server {
    listen 8081;
    server_name 10.150.150.130;

    root /data/webapplication/resl_approval/Quality/frontend/dist;
    index index.html;
    client_max_body_size 50m;

    location /assets/ {
        access_log off;
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    location /_serverFn/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location /mw/ {
        proxy_pass http://127.0.0.1:3002/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location /supabase/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
    }

    location /studio/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Important slash behavior:

- `proxy_pass http://127.0.0.1:8080;` has no trailing slash, preserving `/_serverFn/...` and `/api/...`.
- `proxy_pass http://127.0.0.1:3002/;` strips `/mw/` before forwarding to the middleware.
- `proxy_pass http://127.0.0.1:8000/;` strips `/supabase/` before forwarding to the backend gateway.

Activate only after validation:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 8. End-to-end verification in order

Do not test browser login until every lower hop passes:

```bash
# 1. Middleware is alive; do not disturb it
curl -fsS http://127.0.0.1:3002/__health

# 2. Backend/auth is alive
curl -fsS http://127.0.0.1:8000/auth/v1/health

# 3. Application server is alive
curl -i http://127.0.0.1:8080/

# 4. Nginx reaches application server
curl -i http://127.0.0.1:8081/
curl -i -X POST http://127.0.0.1:8081/api/public/middleware/config \
  -H 'content-type: application/json' \
  -d '{"name":"Login_API"}'

# 5. Nginx reaches middleware and backend
curl -fsS http://127.0.0.1:8081/mw/__health
curl -fsS http://127.0.0.1:8081/supabase/auth/v1/health
```

Then submit one SAP login while watching both logs in separate terminals:

```bash
pm2 logs Qty_App --lines 100
pm2 logs Qty_Approval --lines 100
```

Expected sequence:

1. Browser sends the generated `/_serverFn/...` login RPC through Nginx.
2. `Qty_App` loads `Login_API` and middleware settings from the Quality backend.
3. `Qty_App` posts `{ inputs: { LOGIN: { USER, PASSWORD } } }` to `http://127.0.0.1:3002/login/Login_API`.
4. `Qty_Approval` loads the named config through `/api/public/middleware/config`, calls SAP, and returns SAP's response.
5. `Qty_App` creates/verifies the application session through the Quality backend.
6. The browser navigates to the inbox.

This isolates failures precisely: 502 means the Nginx upstream is unavailable; 401 from middleware/config means a shared-secret mismatch; backend auth errors mean the Quality keys/URL are inconsistent; SAP status/errors appear only after both PM2 processes and the backend path are healthy.

## Scope of the code change

One source file changes: `scripts/collect-dist.mjs`, correcting the escaped newline expression used to generate `dist/start.mjs`. The middleware code and its working PM2 process are not changed.