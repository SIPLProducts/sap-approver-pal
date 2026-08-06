# Finish the Quality deployment — app server on 8080

## Your frontend build env

```text
VITE_SUPABASE_PROJECT_ID=Quality
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...D9Dk
VITE_SUPABASE_URL=http://10.150.150.130:8000
```

This is fine and it will work, with one condition and one caveat:

- **Condition:** port `8000` must be reachable from the users' browsers, not just from the server itself. These `VITE_*` values are baked into the JS bundle and run in the browser, so the browser connects straight to Kong on `10.150.150.130:8000`, bypassing nginx. Check from a user machine:
  ```bash
  curl -i http://10.150.150.130:8000/auth/v1/health
  ```
  A `401 "No API key found in request"` is the correct answer — it means Kong is reachable. A timeout means the firewall blocks 8000 and you must instead rebuild with `VITE_SUPABASE_URL=http://10.150.150.130:8081/supabase` so traffic goes through the nginx `/supabase/` proxy you already configured.
- **Caveat:** `VITE_SUPABASE_PUBLISHABLE_KEY` must be **byte-identical** to `ANON_KEY` in `/data/webapplication/resl_approval/Quality/backend/.env`. If they differ, every browser call fails with an invalid-JWT error. Verify:
  ```bash
  grep '^ANON_KEY=' /data/webapplication/resl_approval/Quality/backend/.env
  ```

`VITE_SUPABASE_PROJECT_ID=Quality` is only a label — harmless.

## The remaining blocker: nothing is listening on 8080

`/_serverFn/ping` returns **502**, which means nginx is routing correctly but the app server is down. Every SAP call (login, PR/PO/ZNFA release, MIGO, user management, e-mail, push) goes through `/_serverFn/*`, so nothing works until this runs.

`npm start` runs `scripts/start-server.mjs`, which needs **both** `dist/server/index.mjs` and `node_modules` (it serves the bundle with wrangler).

### Step 1 — Verify prerequisites on the server

```bash
cd /data/webapplication/resl_approval/Quality/frontend
ls dist/server/index.mjs
ls -d node_modules/wrangler
node -v
```

- `dist/server/index.mjs` missing → the build wasn't fully copied. Re-run `npm run build` and `rsync -a dist/ ...` including `dist/server`.
- `node_modules/wrangler` missing → run `npm ci` in this folder.
- Node must be 20+.

### Step 2 — Start in the foreground first

```bash
cd /data/webapplication/resl_approval/Quality/frontend
PORT=8080 HOST=127.0.0.1 npm start
```

Expect `[start] serving dist/ on http://127.0.0.1:8080`. From a second shell:

```bash
curl -i -X POST http://10.150.150.130:8081/_serverFn/ping
```

Anything other than 502 — a JSON body, a 404, even a 500 — means the chain works.

### Step 3 — Server-side environment variables

The app server needs its own **unprefixed** variables at runtime; the `VITE_*` ones above are browser-only and already compiled in. Create:

```javascript
// /data/webapplication/resl_approval/Quality/frontend/ecosystem.config.cjs
module.exports = {
  apps: [{
    name: "Qty-App",
    cwd: "/data/webapplication/resl_approval/Quality/frontend",
    script: "npm",
    args: "start",
    autorestart: true,
    env: {
      PORT: "8080",
      HOST: "127.0.0.1",
      NODE_ENV: "production",
      SUPABASE_URL: "http://127.0.0.1:8000",
      SUPABASE_PUBLISHABLE_KEY: "<ANON_KEY from backend/.env>",
      SUPABASE_ANON_KEY: "<ANON_KEY from backend/.env>",
      SUPABASE_SERVICE_ROLE_KEY: "<SERVICE_ROLE_KEY from backend/.env>",
      MIDDLEWARE_SHARED_SECRET: "123456",
    },
  }],
};
```

`SUPABASE_URL` uses `127.0.0.1:8000` here because this runs **on** the server. The service-role key is mandatory: SAP login calls it to create the backend session, so without it login fails even when SAP accepts the password.

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 logs Qty-App --lines 30
ss -ltnp | grep 8080
```

### Step 4 — App-side SAP settings

Once the login page posts successfully, in **SAP API Settings → Middleware Configuration**:

- Via Proxy: enabled
- Middleware URL: `http://10.150.150.130:8081/mw`
- Proxy Secret: `123456` (matches `MIDDLEWARE_SHARED_SECRET`)
- SAP Base URL: `http://10.150.150.155:8005`

and confirm `Login_API` exists and is active — otherwise login returns "Login_API is not configured in SAP API Settings".

## Login flow

SAP is the sole authority on the password. The browser posts to `/_serverFn/*` → the app server calls SAP `Login_API` through the middleware → on success it creates/finds the matching backend user, mints a one-time token so the browser gets a session, and caches the SAP profile (plants, roles, activities, PR/PO/NFA release keys) that drives screen permissions. The database never stores or verifies the SAP password.
