# 07 — Backend Deployment (SAP middleware)

The backend is the Express service in `middleware/` of the repository. It:

- receives SAP API calls from the app over HTTP
- authenticates them with `MIDDLEWARE_SHARED_SECRET`
- loads the per-API configuration by calling the app's
  `POST /api/public/middleware/config`
- calls SAP, repairs malformed SAP JSON, and writes a sync log back to
  `POST /api/public/middleware/log`

It holds the SAP credentials, so it never faces the public internet without the
shared secret.

---

## 1. Folder setup

```bash
sudo -iu deploy
cd /data/webapplication/resl_approval/Quality

git clone <YOUR_REPO_URL> /tmp/resl-src
rsync -a --delete /tmp/resl-src/middleware/ backend/
rm -rf /tmp/resl-src
ls backend        # server.js  package.json  json-repair.js  response-mapper.js  Dockerfile
```

Later deploys are handled by `scripts/deploy.sh` (guide 12), which repeats the
same rsync.

## 2. Install packages

```bash
cd /data/webapplication/resl_approval/Quality/backend
npm ci --omit=dev
```

- `npm ci` installs exactly what the lockfile pins — reproducible, unlike
  `npm install`.
- `--omit=dev` skips test tooling.
- If `package-lock.json` is absent, run `npm install --omit=dev` once and
  commit the lockfile to the repository.

> The dependency list includes `node-windows`, used only by the optional
> Windows service installer. It installs harmlessly on Linux and is unused.

## 3. Environment variables

Template: `deploy/quality/.env.backend.example`.

```bash
cp /tmp/.env.backend.example /data/webapplication/resl_approval/Quality/backend/.env
chmod 600 /data/webapplication/resl_approval/Quality/backend/.env
```

```ini
# ---- SAP middleware — QUALITY ----
PORT=3005

# MUST match: MIDDLEWARE_SHARED_SECRET in the app's .env, and
# "Proxy Secret / Password" in Admin → SAP API Settings → Middleware Configuration
MIDDLEWARE_SHARED_SECRET=<openssl rand -hex 32>

# The app's own public URL. The middleware calls back into it for config + logs.
APP_BASE_URL=https://quality.example.com

# 1 = offline smoke test using the SAP_BP_* values only (no app call)
MIDDLEWARE_MOCK=0

# ---- Timeouts (ms). Keep Nginx proxy_read_timeout at or above SAP_REQUEST_TIMEOUT_MS ----
SAP_REQUEST_TIMEOUT_MS=300000
SAP_CONNECT_TIMEOUT_MS=60000
SAP_HEADERS_TIMEOUT_MS=60000
SAP_BODY_TIMEOUT_MS=60000

# ---- Optional fallbacks. Per-row values in SAP API Settings always win ----
SAP_BP_API_URL=
SAP_DMS_API_URL=
SAP_BP_USERNAME=
SAP_BP_PASSWORD=
```

| Variable | Notes |
|---|---|
| `MIDDLEWARE_SHARED_SECRET` | the one value that must be identical in three places; rotating it requires updating all three |
| `APP_BASE_URL` | must be reachable **from the server itself**; verify with `curl -sI $APP_BASE_URL/login` |
| `SAP_REQUEST_TIMEOUT_MS` | raised from the default 30 s to 300 s for large SAP reports |
| `MIDDLEWARE_MOCK` | set to `1` only to prove SAP connectivity before the app is up |

## 4. Production configuration

```bash
export NODE_ENV=production      # set by PM2 in the ecosystem file
```

Notes for a production-grade run:

- The process is single-instance. It is I/O bound on SAP, not CPU bound.
- It listens on `127.0.0.1:3005` behind Nginx. Confirm nothing binds `0.0.0.0`:
  `ss -ltnp | grep 3005`.
- Only Nginx (`mw-quality.example.com`) fronts it, and it still requires the
  shared secret on every request.

## 5. PM2 configuration

Already declared as `resl-quality-mw` in
`Quality/scripts/ecosystem.config.cjs` (guide 03). Start it:

```bash
cd /data/webapplication/resl_approval/Quality/scripts
pm2 start ecosystem.config.cjs --only resl-quality-mw
pm2 save
```

## 6. Logging

| Stream | File |
|---|---|
| stdout | `Quality/logs/middleware-out.log` |
| stderr | `Quality/logs/middleware-err.log` |

```bash
pm2 logs resl-quality-mw --lines 100
tail -f /data/webapplication/resl_approval/Quality/logs/middleware-err.log
```

Rotation is handled by `pm2-logrotate` (20 MB, 14 files, gzip).

Each SAP call also writes a row to the application's sync log table via
`/api/public/middleware/log`, visible in the admin UI — use that for
business-level troubleshooting and the PM2 logs for transport-level problems.

## 7. Restart strategy

| Change | Action |
|---|---|
| code change | `pm2 reload resl-quality-mw` |
| `.env` change | `pm2 restart resl-quality-mw --update-env` |
| dependency change | `npm ci --omit=dev && pm2 restart resl-quality-mw` |

PM2 restarts the process automatically on crash (`restart_delay: 3000`,
`max_restarts: 10`) and on memory growth beyond 512 MB.

## 8. Verification

```bash
# Health endpoint (no secret required)
curl -s http://127.0.0.1:3005/__health

# Rejects an unauthenticated call
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:3005/sap/test    # 401

# Offline SAP connectivity proof
#   temporarily set MIDDLEWARE_MOCK=1 and SAP_BP_* values, then restart and retry
```

Through Nginx after guide 10:

```bash
curl -s https://mw-quality.example.com/__health
```

Next: [08 — Frontend Deployment](./08-frontend-deploy.md)
