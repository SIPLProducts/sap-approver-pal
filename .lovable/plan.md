# Start the app server on 8080 — the last remaining piece

## Where you are now

Both curls confirm nginx is fixed:

- `/_serverFn/ping` → **502 Bad Gateway** — nginx now proxies to `127.0.0.1:8080` instead of trying to serve `index.html`. 502 means nothing is listening on 8080.
- `/supabase/auth/v1/health` → **401 "No API key found in request"** from Kong. This is the **correct** response: Kong requires an `apikey` header. The gateway path works.

So the only thing left is the app server.

## What `npm start` actually needs

`npm start` runs `scripts/start-server.mjs`, which:

1. requires `dist/server/index.mjs` to exist — otherwise it prints `[start] dist/server not found — run npm run build first.` and exits;
2. serves the bundle with **wrangler** (`npx wrangler dev --cwd dist/server`), so `node_modules` must be present in the frontend folder, not just `dist/`.

That means the server needs three things on the box:

```text
/data/webapplication/resl_approval/Quality/frontend/
  package.json
  node_modules/          <- required (wrangler lives here)
  scripts/start-server.mjs
  dist/
    index.html
    assets/
    server/index.mjs     <- required
```

## Step 1 — Verify what is on the server

```bash
cd /data/webapplication/resl_approval/Quality/frontend
ls dist/server/index.mjs
ls -d node_modules/wrangler
node -v
```

- `dist/server/index.mjs` missing → the build wasn't copied. Re-run `npm run build` on the build machine and `rsync -a dist/ ...` again (copy the whole `dist/`, including `dist/server`).
- `node_modules/wrangler` missing → run `npm ci` in this folder on the server.
- Node must be 20+.

## Step 2 — Start it in the foreground first

Do this before pm2 so you can read the error if it fails:

```bash
cd /data/webapplication/resl_approval/Quality/frontend
PORT=8080 HOST=127.0.0.1 npm start
```

Expected output: `[start] serving dist/ on http://127.0.0.1:8080` followed by wrangler's ready line. Leave it running and from a second shell:

```bash
curl -i -X POST http://10.150.150.130:8081/_serverFn/ping
```

Anything other than 502 — a JSON body, a 404 from the app, even a 500 — means the chain nginx → app server works.

## Step 3 — Put it under pm2

Stop the foreground process, then:

```bash
cd /data/webapplication/resl_approval/Quality/frontend
pm2 start npm --name Qty-App -- start
pm2 set Qty-App:PORT 8080
pm2 set Qty-App:HOST 127.0.0.1
pm2 save
pm2 logs Qty-App --lines 30
ss -ltnp | grep 8080
```

`ss` must show a listener on `127.0.0.1:8080`.

If pm2 does not pass the env through reliably, use an explicit ecosystem file instead:

```javascript
// /data/webapplication/resl_approval/Quality/frontend/ecosystem.config.cjs
module.exports = {
  apps: [{
    name: "Qty-App",
    cwd: "/data/webapplication/resl_approval/Quality/frontend",
    script: "npm",
    args: "start",
    env: { PORT: "8080", HOST: "127.0.0.1", NODE_ENV: "production" },
    autorestart: true,
  }],
};
```

```bash
pm2 start ecosystem.config.cjs && pm2 save
```

## Step 4 — Server environment variables the app needs

The app server talks to the self-hosted backend, so these must be in its environment (add them to the `env` block of the ecosystem file):

```text
SUPABASE_URL=http://127.0.0.1:8000
SUPABASE_ANON_KEY=<ANON_KEY from backend/.env>
SUPABASE_PUBLISHABLE_KEY=<same ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from backend/.env>
MIDDLEWARE_SHARED_SECRET=123456
```

Take `ANON_KEY` and `SERVICE_ROLE_KEY` verbatim from `/data/webapplication/resl_approval/Quality/backend/.env`. Without the service-role key, SAP login fails at the "create backend session" step even when SAP itself accepts the password.

Note the browser-side values (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) are baked in at **build** time, not read at runtime — so they must point at `http://10.150.150.130:8081/supabase` when you run `npm run build`. If the built bundle still points at a different backend, the login page will fail in the browser regardless of the server env.

## Step 5 — Then finish the app-side config

Once the login page loads and posts successfully, in **SAP API Settings → Middleware Configuration** set:

- Via Proxy: enabled
- Middleware URL: `http://10.150.150.130:8081/mw`
- Proxy Secret: `123456`
- SAP Base URL: `http://10.150.150.155:8005`

and confirm `Login_API` exists and is active.

## Login flow, to confirm your earlier question

SAP is the only authority on the password. The browser posts to `/_serverFn/*` → the app server calls SAP `Login_API` through the middleware → on success the app server creates/finds the matching backend user and mints a one-time token so the browser gets a session, and caches the SAP profile (plants, roles, activities, release keys) that drives screen permissions. The database never stores or verifies the SAP password.
