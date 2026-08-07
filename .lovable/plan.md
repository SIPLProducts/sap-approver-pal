# Quality server: app server on 8080 + Supabase (backend) setup

Two separate things are missing. Your `pm2 ls` shows only ONE process
(`Qty_Approval`), and its logs show it is the **SAP middleware on :3002** — not
the app server. And the Supabase stack in `backend/` has no schema yet.

## 1. What "the app server on 8080" is

Your deployment has three app processes, not one:

| Process | Port | What it is | Running? |
| --- | --- | --- | --- |
| Nginx | 8081 | serves `dist/` + proxies | yes |
| SAP middleware (`middleware/server.js`) | 3002 | talks to SAP | yes (`Qty_Approval`) |
| **App server (`npm start` in `frontend/`)** | **8080** | runs every `/_serverFn/*` and `/api/*` — SAP login, PR/PO/ZNFA, MIGO, users, mail, push | **NO — this is the 502** |
| Supabase stack (Kong) | 8000 | auth + database | containers up, schema missing |

The static `dist/` files cannot call SAP or create a session by themselves. The
browser posts to `/_serverFn/<hash>`; Nginx forwards that to `127.0.0.1:8080`;
nothing listens there, so Nginx answers **502 Bad Gateway** — exactly the popup
in your screenshot.

### Start it

```bash
cd /data/webapplication/resl_approval/Quality/frontend
ls dist/server/index.mjs        # must exist (from npm run build)
ls -d node_modules/wrangler     # if missing: npm ci
PORT=8080 HOST=127.0.0.1 npm start
```

Expect `[start] serving dist/ on http://127.0.0.1:8080`. Then, once it works,
run it under pm2 as a **second** process:

```js
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
      SUPABASE_SERVICE_ROLE_KEY: "<SERVICE_ROLE_KEY from backend/.env>",
    },
  }],
};
```

```bash
pm2 start ecosystem.config.cjs && pm2 save
pm2 ls                       # must now show Qty_Approval AND Qty-App
curl -i -X POST http://10.150.150.130:8081/_serverFn/ping   # any answer but 502
```

The **service role key is mandatory** — SAP login uses it to create the user and
mint the one-time login token. Without it login fails even when SAP accepts the
password.

## 2. Create the Supabase schema (backend)

Your containers already came up healthy. What is missing is the **schema**: the
`profiles`, `user_roles`, `sap_api_configs`, `sap_global_settings` tables, the
`handle_new_user` trigger, etc. All of it lives in this repo under
`supabase/migrations/` (about 30 `.sql` files, applied in filename order).

```bash
# copy the migration files onto the server (from your build machine)
rsync -a supabase/migrations/ \
  root@10.150.150.130:/data/webapplication/resl_approval/Quality/backend/migrations/

# on the server: apply them in order
cd /data/webapplication/resl_approval/Quality/backend
for f in $(ls migrations/*.sql | sort); do
  echo ">> $f"
  docker compose -p resl_quality exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$f" || break
done
```

Verify:

```bash
docker compose -p resl_quality exec -T db psql -U postgres -d postgres \
  -c "\dt public.*"
curl -i http://127.0.0.1:8000/rest/v1/profiles -H "apikey: <ANON_KEY>"
```

Key rules for this stack:

- `JWT_SECRET`, `ANON_KEY` and `SERVICE_ROLE_KEY` in `backend/.env` must be
  consistent with each other (the two keys are JWTs signed with that secret).
- `VITE_SUPABASE_PUBLISHABLE_KEY` in the frontend build must be **byte
  identical** to `ANON_KEY`, or every browser call fails with an invalid JWT.
- Never delete `volumes/db/data` — that is the live database.

## 3. Seed the first admin + SAP settings

1. Open `http://10.150.150.130:8081/login` and sign in with a valid SAP user.
   The app creates the backend user on the fly, and the existing
   `handle_new_user` trigger gives the **first** user the Admin role.
2. As that admin, open **SAP API Settings → Global settings** and set:
   - Connection Mode: Via Proxy (middleware)
   - Middleware URL: `http://127.0.0.1:3002` (server-side call) or
     `http://10.150.150.130:8081/mw`
   - Proxy secret = `MIDDLEWARE_SHARED_SECRET` in the middleware `.env`
   - SAP Base URL: `http://10.150.150.155:8005`
   - press "Test connection" (hits `{middleware}/__health`)
3. Confirm an **active** API config named exactly `Login_API` exists — otherwise
   login returns "Login_API is not configured in SAP API Settings".

Note: your middleware log shows `app: http://10.150.150.130:8081` — correct. The
earlier line pointing at `http://10.150.150.155:8005` was an older build.

## 4. Full login flow on the server

```text
browser :8081  →  Nginx  →  /_serverFn/*  →  app server :8080
                                              → middleware :3002 → SAP (validates password)
                                              → Supabase :8000  (creates user, mints token)
browser  →  Supabase :8000 verifyOtp  →  session  →  app opens
```

So SAP is the only password authority, and Supabase is required for the session,
profile, roles and RLS data. Nothing works until **both** :8080 and the
:8000 schema are in place.

## 5. Order of operations

1. Apply migrations (section 2).
2. Start `Qty-App` on 8080 with all three Supabase env vars (section 1).
3. `curl` the `/ping` check → no more 502.
4. Log in with SAP, configure middleware settings (section 3).

## Notes

- No app code changes are needed for any of this — it is purely server setup.
- If you want, I can add sections 1-4 as a checklist inside `DEPLOY-QUALITY.md`
  so it lives with the repo.
