# Server deployment + login flow (Quality, 10.150.150.130)

Your Nginx config is already correct. The missing pieces are the app server on
port 8080 and the SAP middleware URL stored in the database. No app code changes
are needed.

## 1. How login actually works (same locally and on the server)

```text
Browser (login page, :8081)
  -> POST /_serverFn/<hash>        (Nginx -> app server 127.0.0.1:8080)
       app server: sapLogin()
         -> reads Login_API config + middleware URL from the database
         -> POST {middleware}/login/Login_API   (SAP middleware :3002)
              -> SAP
         <- SAP returns success + user profile (plants, roles, keys)
         -> creates/matches the backend user, writes profile + sap_profile
         -> returns { email, tokenHash }
  <- Browser calls supabase.auth.verifyOtp({ email, token_hash })
       -> session cookie/localStorage set, user enters the app
```

So: **SAP validates the username/password**, and the **backend (Supabase) issues
the session**. Supabase is required — without it there is no session, no
profile/roles, no RLS data, and the login cannot complete. There is no local-only
or offline login path (the demo account was removed earlier).

Three processes must be running on the server:

| Piece | Port | Purpose |
| --- | --- | --- |
| Nginx | 8081 | serves `dist/` and proxies everything else |
| App server (`npm start`) | 8080 | server functions (`/_serverFn/`, `/api/`) |
| SAP middleware | 3002 | proxies calls to SAP |
| Supabase stack (Kong) | 8000 | auth, database, RLS |

## 2. Build the frontend + server bundle

`npm run build` produces both the static shell and the server bundle. Deploy the
whole `dist/` folder — not just `dist/client`.

On a build machine, in the project root, with `.env` containing:

```text
VITE_SUPABASE_PROJECT_ID=Quality
VITE_SUPABASE_URL=http://10.150.150.130:8000
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key from the Supabase stack .env>
```

Then:

```bash
npm ci
npm run build
```

Result: `dist/client/...` (static shell + `assets/`) and `dist/server/index.mjs`.

Copy to the server:

```bash
rsync -a --delete dist/ root@10.150.150.130:/data/webapplication/resl_approval/Quality/app/dist/
```

Nginx `root` must point at the folder containing `index.html` (`dist/client`),
so either set `root .../app/dist/client;` or keep your current path and copy
`dist/client/*` into `.../frontend/dist/`. The server bundle stays with the app
server folder.

## 3. Run the app server on 8080 (fixes the 502 you are seeing)

In `/data/webapplication/resl_approval/Quality/app` (needs `package.json` +
`node_modules` so `wrangler` is available):

```js
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: "Qty-App",
    cwd: "/data/webapplication/resl_approval/Quality/app",
    script: "npm",
    args: "start",
    env: {
      PORT: "8080",
      HOST: "127.0.0.1",
      SUPABASE_URL: "http://127.0.0.1:8000",
      SUPABASE_PUBLISHABLE_KEY: "<anon key>",
      SUPABASE_SERVICE_ROLE_KEY: "<service role key from the Supabase stack .env>",
    },
  }],
};
```

```bash
pm2 start ecosystem.config.cjs && pm2 save
curl -i -X POST http://127.0.0.1:8080/_serverFn/ping   # should not be 502
```

The service role key is required — `sapLogin` uses it to create the user and mint
the login token.

## 4. Point the app at the SAP middleware

This is configuration in the app, not in a file: sign in as an admin and open
**SAP API Settings → Global settings**:

- Connection Mode: **Via Proxy (middleware)**
- Node.js Middleware URL: `http://127.0.0.1:3002` (the app server calls it
  server-side, so localhost is correct; use `http://10.150.150.130:8081/mw` only
  if you prefer routing through Nginx)
- Proxy shared secret: same value as `MIDDLEWARE_SHARED_SECRET` in the
  middleware `.env`
- Use the "Test connection" action — it hits `{middleware}/__health`

Also confirm an active API config named exactly `Login_API` exists, and that the
middleware `.env` has `APP_BASE_URL=http://10.150.150.130:8081` and the SAP base
URL/credentials.

## 5. Verification order

1. `curl -i http://127.0.0.1:3002/__health` — middleware up
2. `curl -i -X POST http://10.150.150.130:8081/_serverFn/ping` — app server via Nginx
3. `curl -i http://10.150.150.130:8081/supabase/auth/v1/health -H "apikey: <anon>"` — Supabase reachable
4. Open `http://10.150.150.130:8081/login` and sign in with a SAP user; on
   failure check `pm2 logs Qty-App` and the middleware log — the SAP message is
   surfaced verbatim.

## Notes

- If the first login on a fresh database must be an admin, the first created
  user is auto-assigned the Admin role by the existing signup trigger.
- Nothing in the app code needs to change for this deployment; if you want, I can
  add a short `DEPLOY-QUALITY.md` section capturing steps 2-5 as a checklist.
