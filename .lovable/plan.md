# Make dist/ actually runnable on 8080

## Root cause

`frontend/` on the Quality server contains only `dist/`:

```text
frontend/
└── dist/
    ├── assets/  favicon.ico  _headers  index.html  manifest.webmanifest  sw.js
    └── server/  index.mjs  wrangler.json  _chunks  _ssr  _libs ...
```

`dist/` is a build artifact, not a self-starting server. The build produces a **Cloudflare Workers bundle** (`dist/server/index.mjs` plus `dist/server/wrangler.json`), and it must be served by the `wrangler` runtime. The project starts it via `npm start` -> `scripts/start-server.mjs`, which runs `npx wrangler dev --cwd dist/server`.

On this server none of that is present: no `package.json`, no `scripts/`, no `node_modules/wrangler`. So there is no process that could ever listen on 8080, and Nginx returns `502 / Connection refused` for every `/_serverFn/*` login post. `dist/` alone only gives Nginx static files to serve — the login page renders, but its backend cannot answer.

## The fix: add a small runtime next to dist/

Only `wrangler` is needed at runtime — not the full app dependency tree. Create two files in `/data/webapplication/resl_approval/Quality/frontend/`.

### 1. `package.json`

```json
{
  "name": "resl-approval-runtime",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "wrangler dev --cwd dist/server --ip 127.0.0.1 --port 8080"
  },
  "dependencies": {
    "wrangler": "^4.42.0"
  }
}
```

Pin `wrangler` to the same major version the build used, then install:

```bash
cd /data/webapplication/resl_approval/Quality/frontend
npm install
ls -d node_modules/wrangler
```

This requires internet or npm-mirror access from the server. If npm is blocked, use the alternative in the section below instead.

### 2. `.env.runtime` with the server-side variables

These are the unprefixed runtime variables. The `VITE_*` values are already compiled into `dist/assets` and are not enough.

```bash
cd /data/webapplication/resl_approval/Quality/frontend
grep -E '^(ANON_KEY|SERVICE_ROLE_KEY)=' ../backend/.env
```

```ini
PORT=8080
HOST=127.0.0.1
NODE_ENV=production
SUPABASE_URL=http://127.0.0.1:8000
SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>
SUPABASE_ANON_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
MIDDLEWARE_SHARED_SECRET=<same secret the middleware uses>
```

`SUPABASE_SERVICE_ROLE_KEY` is mandatory: after SAP accepts the password, the app server uses it to create the backend session. Without it, login fails even though your direct SAP `curl` succeeds.

### 3. Start it in the foreground and confirm 8080 answers

```bash
cd /data/webapplication/resl_approval/Quality/frontend
set -a; . ./.env.runtime; set +a
npx wrangler dev --cwd dist/server --ip 127.0.0.1 --port 8080
```

From a second shell:

```bash
ss -ltnp | grep ':8080'
curl -i --connect-timeout 5 http://127.0.0.1:8080/login
curl -i -X POST --connect-timeout 5 http://10.150.150.130:8081/_serverFn/ping
```

Anything other than 502 on the last command means the chain is finally connected.

## Alternative if npm install is blocked on the server

Copy the already-installed runtime from your build machine instead of installing on the server. From the machine where `npm run build` works:

```bash
# on the build machine, in the project root
rsync -a package.json scripts/ \
  root@10.150.150.130:/data/webapplication/resl_approval/Quality/frontend/
rsync -a node_modules/ \
  root@10.150.150.130:/data/webapplication/resl_approval/Quality/frontend/node_modules/
```

Then on the server `npm start` works as documented, because `scripts/start-server.mjs` and `node_modules/wrangler` are both present.

Going forward, deploys must copy `dist/` **plus** the runtime files — copying `dist/` alone will always reproduce this 502.

## 4. Run both processes under PM2

Right now PM2 has a single process, `Qty_Approval`, which is the middleware on 3002. Add the app server as a second process and keep the middleware untouched.

`/data/webapplication/resl_approval/Quality/frontend/ecosystem.config.cjs`:

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
        MIDDLEWARE_SHARED_SECRET: "<same secret the middleware uses>",
      },
    },
  ],
};
```

```bash
cd /data/webapplication/resl_approval/Quality/frontend
pm2 start ecosystem.config.cjs
pm2 save
pm2 ls            # must show TWO online processes
pm2 logs Qty_App --lines 40
```

## 5. Point the app at the middleware, then log in

In the app, SAP API Settings -> Middleware Configuration:

- Middleware URL: `http://127.0.0.1:3002`
- Proxy Secret: identical to `MIDDLEWARE_SHARED_SECRET`
- SAP Base URL: `http://10.150.150.155:8005`
- `Login_API`: active, POST, `/sd_approval_mng/login/login?sap-client=300`
- Global SAP Connection username/password: the pair that worked in your `curl`

Watch both processes and sign in once as `22011840`:

```bash
pm2 logs Qty_App --lines 50
pm2 logs Qty_Approval --lines 50
```

- Middleware logs `POST /login/Login_API`: the full chain works.
- App logs a middleware connection error: the saved middleware URL is wrong.
- Middleware returns 401: the proxy secret and `MIDDLEWARE_SHARED_SECRET` differ.

## Success criteria

1. `ss -ltnp | grep ':8080'` shows a listener.
2. `pm2 ls` shows two online processes (3002 middleware, 8080 app).
3. `/_serverFn/ping` through Nginx no longer returns 502.
4. Browser login for `22011840` reaches the inbox.

No application code changes are required — this is entirely missing runtime files and a missing process on the server. Rotate the SAP and login credentials that were pasted into shared messages once login works.
