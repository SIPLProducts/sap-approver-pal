# Make `dist/` self-starting so deploying it is enough

## The problem with today's output

`npm run build` produces a correct `dist/`, but it contains only static files plus a Cloudflare Workers bundle in `dist/server/`. There is no `package.json`, no start script, and no runtime dependency, so the folder cannot launch a process. On the server, `frontend/` had only `dist/`, so nothing ever listened on 8080 and Nginx returned `502` for every `/_serverFn/*` login post.

The fix is to make the build emit the small runtime alongside the bundle, so the deployed folder is self-contained.

## Code change: emit a runtime into `dist/`

Edit `scripts/collect-dist.mjs`. Today it deletes `package.json` from the dist root (`DROP_AT_ROOT`). Change it to instead write a purpose-built runtime `package.json` and copy the start script in.

Two additions:

1. Stop dropping the file blindly, then write a fresh runtime manifest at `dist/package.json`:

```json
{
  "name": "resl-approval-server",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node start-server.mjs"
  },
  "dependencies": {
    "wrangler": "<same version as the project's devDependency>"
  }
}
```

The `wrangler` version is read from the project's own `package.json` at build time so the runtime always matches the bundle that was built.

2. Copy `scripts/start-server.mjs` to `dist/start-server.mjs`, adjusted so it resolves the bundle at `./server` (relative to `dist/`) instead of `./dist/server`, and keeps honoring `PORT` and `HOST`.

After this change, `npm run build` yields:

```text
dist/
├── assets/ favicon.ico index.html manifest.webmanifest sw.js _headers
├── server/            <- the app bundle (server functions, SSR)
├── package.json       <- new: runtime manifest
└── start-server.mjs   <- new: launcher
```

## Deploying it

Copy `dist/` to the server, install its one dependency, and start it:

```bash
cd /data/webapplication/resl_approval/Quality/frontend/dist
npm install          # installs wrangler only
PORT=8080 HOST=127.0.0.1 npm start
ss -ltnp | grep ':8080'
```

If the server has no npm access, run `npm install` inside `dist/` on your build machine before copying, and ship `dist/node_modules` along with it.

Nginx keeps serving statics from this same folder, so `root .../frontend/dist;` stays unchanged.

## Runtime environment variables (these are the ones missing today)

Your `.env` values are compiled into the browser bundle at build time. The server process needs its own **unprefixed** variables at runtime, and login cannot work without them.

```bash
cd /data/webapplication/resl_approval/Quality/frontend/dist
grep -E '^(ANON_KEY|SERVICE_ROLE_KEY)=' ../../backend/.env
```

Create `dist/.env.runtime`:

```ini
PORT=8080
HOST=127.0.0.1
NODE_ENV=production
SUPABASE_URL=http://127.0.0.1:8000
SUPABASE_PUBLISHABLE_KEY=<ANON_KEY from backend/.env>
SUPABASE_ANON_KEY=<ANON_KEY from backend/.env>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from backend/.env>
MIDDLEWARE_SHARED_SECRET=<same secret the middleware uses>
```

`SUPABASE_SERVICE_ROLE_KEY` is mandatory. After SAP accepts the password, the app server uses it to create the backend session and store the SAP profile. Without it, login fails even though your direct SAP `curl` succeeds.

## About your build-time `.env`

```ini
VITE_SUPABASE_PROJECT_ID=Quality
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...D9Dk
VITE_SUPABASE_URL=http://10.150.150.130:8000
```

- `VITE_SUPABASE_URL=http://10.150.150.130:8000` runs in the **user's browser**, so port 8000 must be open to user machines, not just to the server. Check from a user PC: `curl -i http://10.150.150.130:8000/auth/v1/health`. A `401 "No API key found in request"` means reachable; a timeout means you must rebuild with `VITE_SUPABASE_URL=http://10.150.150.130:8081/supabase` so it goes through your Nginx proxy.
- `VITE_SUPABASE_PUBLISHABLE_KEY` must be byte-identical to `ANON_KEY` in `backend/.env`, or every browser call fails with an invalid-JWT error.
- `VITE_SUPABASE_PROJECT_ID=Quality` is just a label and is harmless.

## PM2: run the app next to the middleware

PM2 currently runs one process (`Qty_Approval`, the middleware on 3002). Add the app server as a second process:

```bash
cd /data/webapplication/resl_approval/Quality/frontend/dist
set -a; . ./.env.runtime; set +a
pm2 start npm --name Qty_App -- start
pm2 save
pm2 ls           # must show TWO online processes
pm2 logs Qty_App --lines 40
```

## Then finish the SAP wiring

In the app, SAP API Settings, Middleware Configuration:

- Middleware URL: `http://127.0.0.1:3002`
- Proxy Secret: identical to `MIDDLEWARE_SHARED_SECRET`
- SAP Base URL: `http://10.150.150.155:8005`
- `Login_API`: active, POST, `/sd_approval_mng/login/login?sap-client=300`
- Global SAP Connection username/password: the pair that worked in your `curl`

## Success criteria

1. `ss -ltnp | grep ':8080'` shows a listener.
2. `pm2 ls` shows two online processes.
3. `curl -i -X POST http://10.150.150.130:8081/_serverFn/ping` returns anything but 502.
4. Signing in as `22011840` reaches the inbox, and the middleware logs `POST /login/Login_API`.

## Scope

One file changes in the codebase: `scripts/collect-dist.mjs`. No application, SAP, or UI logic is touched. Rotate the SAP and login credentials that were pasted into shared messages once login works.
