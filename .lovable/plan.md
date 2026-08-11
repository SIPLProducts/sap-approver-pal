# Start the app server on 8080 (fixes the login 502)

## What the evidence shows

SAP is now reachable from the Quality server — your direct `curl` returned the full `USER`/`PLANTS` JSON for `22011840`. So SAP, credentials, and network access are no longer the problem.

`pm2 ls` shows exactly one process, `Qty_Approval`, and its output is:

```text
[sap-middleware] listening on :3002 (live mode)
[sap-middleware] app: http://10.150.150.130:8081
```

That is the **middleware** — not the application server. Nothing is running on port 8080, which is why Nginx logs `connect() failed (111: Connection refused) ... upstream: http://127.0.0.1:8080/_serverFn/...` and the browser shows `502 Bad Gateway`.

## Why 8080 is required and separate from 3002

They are two different programs with two different jobs:

```text
Browser  ->  Nginx :8081
               |
               |-- /                 -> frontend static files (dist)
               |-- /_serverFn/*      -> APP SERVER :8080     <-- MISSING
               |-- /mw/              -> MIDDLEWARE :3002     <-- running
```

- **Port 8080 (app server)** runs your application's backend logic: the `sapLogin` server function, the backend session/token creation, profile storage, all SAP screen calls. Every login click posts to `/_serverFn/<hash>`, which only this process can answer.
- **Port 3002 (middleware)** is only a relay to SAP. It is called *by* the app server on 8080, not by the browser.

So the middleware being healthy on 3002 does not help: the request never gets that far, because the process that would call it does not exist. That is also why the direct `curl` works while the app fails — `curl` skips the missing 8080 hop entirely.

## 1. Confirm nothing is on 8080

```bash
ss -ltnp | grep ':8080' || echo "NOTHING LISTENING ON 8080"
```

## 2. Check the app build and dependencies are present

The app server is started by `scripts/start-server.mjs`, which requires both `dist/server/index.mjs` and installed `node_modules` (it serves the bundle with wrangler).

```bash
cd /data/webapplication/resl_approval/Quality/frontend
pwd
ls -l dist/server/index.mjs
ls -l package.json scripts/start-server.mjs
ls -d node_modules/wrangler 2>/dev/null || echo "node_modules MISSING"
node -v
```

- `dist/server/index.mjs` missing: the build was copied without the server bundle. Re-run `npm run build` on the build machine and copy the whole `dist/` tree, including `dist/server`.
- `node_modules/wrangler` missing: run `npm ci --include=dev` in this folder.
- Node must be 20 or newer.

## 3. Start it in the foreground first

Run it directly so any startup error is visible instead of hidden by PM2:

```bash
cd /data/webapplication/resl_approval/Quality/frontend
PORT=8080 HOST=127.0.0.1 \
NODE_ENV=production \
SUPABASE_URL=http://127.0.0.1:8000 \
SUPABASE_PUBLISHABLE_KEY='<ANON_KEY from backend/.env>' \
SUPABASE_ANON_KEY='<ANON_KEY from backend/.env>' \
SUPABASE_SERVICE_ROLE_KEY='<SERVICE_ROLE_KEY from backend/.env>' \
MIDDLEWARE_SHARED_SECRET='<same secret as the middleware>' \
npm start
```

Expect `[start] serving dist/ on http://127.0.0.1:8080`. From a second shell:

```bash
ss -ltnp | grep ':8080'
curl -i --connect-timeout 5 http://127.0.0.1:8080/login
```

`SUPABASE_SERVICE_ROLE_KEY` is mandatory: after SAP accepts the password, the app server uses it to create the backend session. Without it, login fails even though SAP said OK. Read the values from `backend/.env`:

```bash
grep -E '^(ANON_KEY|SERVICE_ROLE_KEY)=' /data/webapplication/resl_approval/Quality/backend/.env
```

## 4. Run it permanently under PM2 as a second process

Keep the middleware process as it is and add the app server alongside it. Create `/data/webapplication/resl_approval/Quality/frontend/ecosystem.config.cjs`:

```javascript
module.exports = {
  apps: [
    {
      name: "Qty_App",
      cwd: "/data/webapplication/resl_approval/Quality/frontend",
      script: "npm",
      args: "start",
      autorestart: true,
      env: {
        PORT: "8080",
        HOST: "127.0.0.1",
        NODE_ENV: "production",
        SUPABASE_URL: "http://127.0.0.1:8000",
        SUPABASE_PUBLISHABLE_KEY: "<ANON_KEY>",
        SUPABASE_ANON_KEY: "<ANON_KEY>",
        SUPABASE_SERVICE_ROLE_KEY: "<SERVICE_ROLE_KEY>",
        MIDDLEWARE_SHARED_SECRET: "<same secret as the middleware>",
      },
    },
  ],
};
```

```bash
cd /data/webapplication/resl_approval/Quality/frontend
pm2 start ecosystem.config.cjs
pm2 save
pm2 ls          # must now show TWO processes: Qty_Approval (3002) and Qty_App (8080)
pm2 logs Qty_App --lines 40
```

## 5. Point the app at the middleware and retry login

In the app, under SAP API Settings, Middleware Configuration:

- Middleware URL: `http://127.0.0.1:3002` (the app server calls it locally; `http://10.150.150.130:8081/mw` also works if you prefer to go through Nginx)
- Proxy Secret: identical to the middleware's shared secret
- SAP Base URL: `http://10.150.150.155:8005`
- `Login_API` row: active, POST, endpoint `/sd_approval_mng/login/login?sap-client=300`
- Global SAP Connection username/password: the same pair that worked in your `curl`

Then watch both processes and click Sign in once:

```bash
pm2 logs Qty_App --lines 50
pm2 logs Qty_Approval --lines 50
```

- No more 502 and a middleware log line `POST /login/Login_API`: the chain is complete.
- App log shows a middleware connection error: the saved middleware URL is wrong.
- Middleware returns 401: the proxy secret and `MIDDLEWARE_SHARED_SECRET` differ.

## 6. Success criteria

1. `ss -ltnp | grep ':8080'` shows a listener.
2. `pm2 ls` shows two online processes.
3. `curl -i http://10.150.150.130:8081/_serverFn/ping` returns anything other than 502.
4. Browser login for `22011840` reaches the inbox.

No application code changes are needed for this — it is entirely a process/startup issue on the server. Because SAP and login credentials were pasted into shared messages, rotate them once login is working.
