# RESL Approvals — Production deployment runbook

Target box: `ReAprMatrix` (`10.150.150.130`), folder
`/data/webapplication/resl_approval/Production/`.

Production runs **completely beside** Quality — different ports, different
Docker compose project, different database, different keys.

## Port map

| Port | Service              | Exposure  |
| ---- | -------------------- | --------- |
| 9091 | nginx vhost          | external  |
| 8090 | SSR app server       | localhost |
| 8010 | Supabase Kong HTTP   | localhost |
| 8453 | Supabase Kong HTTPS  | localhost |
| 3010 | SAP middleware       | localhost |
| 3100 | Supabase Studio      | localhost |

Nothing in the application code hardcodes these. The app server reads
`PORT`/`HOST`, the backend URL comes from `SUPABASE_URL` / `VITE_SUPABASE_URL`,
and the SAP middleware URL comes from the database row in
**Admin → SAP API Settings → Middleware Configuration** (with `MIDDLEWARE_URL`
as the server-side fallback).

## Folder layout

```text
Production/
  backend/      # Supabase self-hosted stack (docker compose)
  middleware/   # SAP middleware sources + .env (docker compose)
  frontend/     # .env + dist/ (SSR app server, pm2 "Prod_App")
  logs/         # nginx access/error logs
  scripts/      # helper SQL / shell
```

## 1. Backend (Supabase) — `Production/backend`

```bash
cd /data/webapplication/resl_approval/Production/backend

# 1a. Copy the stack from the repo checkout (do NOT copy Quality's volumes/).
cp -r /path/to/repo/supabase/* .
rm -rf volumes/db/data volumes/storage   # only if they came along

# 1b. Environment
cp /path/to/repo/deploy/production/backend/.env.example .env
chmod 600 .env
```

Fill in `.env`:

```bash
openssl rand -hex 24   # POSTGRES_PASSWORD, DASHBOARD_PASSWORD
openssl rand -hex 32   # JWT_SECRET, SECRET_KEY_BASE, LOGFLARE_* tokens
openssl rand -hex 16   # VAULT_ENC_KEY
```

Then mint `ANON_KEY` and `SERVICE_ROLE_KEY` **from the new Production
`JWT_SECRET`** (HS256, payloads `{"role":"anon","iss":"supabase","iat":…,"exp":…}`
and `{"role":"service_role", …}`). Do **not** reuse the Quality keys you
pasted — they were signed with the Quality `JWT_SECRET`, so a Quality token
would be accepted by Production and vice versa.

Start it:

```bash
docker compose -p resl_production --env-file .env up -d
docker compose -p resl_production ps
curl -i http://127.0.0.1:8010/auth/v1/health      # 200 or 401 = healthy
```

### Schema + seed data

Studio is on `http://127.0.0.1:3100` (also `http://10.150.150.130:9091/studio/`
once nginx is up). Apply, in order, through Studio's SQL editor or `psql`:

```bash
# via psql from the host
psql "postgresql://postgres:<POSTGRES_PASSWORD>@127.0.0.1:5442/postgres" \
  -f scripts/quality-seed-data-sql-editor.sql
```

1. The schema/migration SQL for `public.*` (tables, RLS policies, GRANTs).
2. `scripts/quality-seed-data-sql-editor.sql` — SAP API endpoints, request/
   response field mappings, roles, screens.
3. Update the middleware row for Production:

```sql
update public.sap_global_settings
   set connection_mode = 'via_proxy',
       middleware_port = 3010,
       middleware_url  = 'http://127.0.0.1:3010',
       proxy_secret    = '<MIDDLEWARE_SHARED_SECRET from Production .env>'
 where name = 'default';
```

4. Create the first admin user in Studio → Authentication, then insert its
   role row in `public.user_roles`.

## 2. SAP middleware — `Production/middleware`

```bash
cd /data/webapplication/resl_approval/Production/middleware
cp -r /path/to/repo/middleware/* .
cp /path/to/repo/deploy/production/middleware/.env.example .env
cp /path/to/repo/deploy/production/middleware/docker-compose.yml .
chmod 600 .env
# edit .env: MIDDLEWARE_SHARED_SECRET (long random, different from Quality)

# docker-compose.yml in this folder builds ./ (the copied sources):
docker compose -p resl_production up -d --build
curl -i http://127.0.0.1:3010/__health
```

> If you keep the compose file at the repo path instead, its `context:` already
> points at the repo's `middleware/` folder — run it from
> `deploy/production/middleware/`.

Bare-metal alternative (no Docker):

```bash
npm install --omit=dev
PORT=3010 pm2 start server.js --name Prod_MW --time && pm2 save
```

## 3. Frontend — `Production/frontend`

```bash
cd /data/webapplication/resl_approval/Production/frontend
cp /path/to/repo/deploy/production/frontend/.env.example .env
chmod 600 .env      # fill in the Production ANON/SERVICE keys + shared secret
```

Build (on the build machine, from the repo root, with that same `.env`):

```bash
rm -rf dist .output .wrangler
npm run build:selfhost
npm run package:dist
```

The build now takes `PORT`, `HOST` and `NODE_ENV` from that `.env`, so
`dist/.env.runtime` and `dist/ecosystem.config.cjs` come out on **8090** with
pm2 name `Prod_App` (Quality keeps 8080 / `Qty_App`).

Deploy: extract the archive into an **empty** `Production/frontend/dist/`, then

```bash
cd dist
bash deploy-frontend.sh --port 8090 --nginx-port 9091
```

The helper regenerates `.env.runtime` from `../.env`, verifies the browser
bundle carries `VITE_SUPABASE_PUBLISHABLE_KEY`, restarts pm2 `Prod_App`, and
health-checks the app server, nginx 9091, Kong `SUPABASE_URL` and the
middleware `MIDDLEWARE_URL` from that env — no Quality ports involved.

## 4. nginx

```bash
cp /path/to/repo/deploy/production/nginx/resl-approval-production-9091.conf \
   /etc/nginx/conf.d/
htpasswd -c /etc/nginx/.htpasswd-studio-prod studioadmin   # Studio basic auth
mkdir -p /data/webapplication/resl_approval/Production/logs
nginx -t && nginx -s reload
```

`location /` **proxies** to 127.0.0.1:8090 — never `try_files … /index.html`;
a self-host build ships no static `index.html`.

## 5. Verify

```bash
curl -sI http://127.0.0.1:9091/login | head -n1        # 200, no ETag
curl -s  -o /dev/null -w '%{http_code}\n' \
     -X POST http://127.0.0.1:8090/api/public/middleware/config \
     -H 'content-type: application/json' -d '{"name":"Login_API"}'   # 401 or 200
curl -i http://127.0.0.1:3010/__health
curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8010/auth/v1/health
```

Then log in at `http://10.150.150.130:9091/login` with a Production SAP user.

## Isolation checklist

- Docker compose project `resl_production` (Quality: `resl_quality`).
- Distinct host ports: 9091 / 8090 / 8010 / 8453 / 3010 / 3100 / 5442 / 6553.
- Fresh `JWT_SECRET` + minted `ANON_KEY` / `SERVICE_ROLE_KEY`.
- Different `MIDDLEWARE_SHARED_SECRET`.
- pm2 apps `Prod_App` / `Prod_MW` vs `Qty_App`.
- Separate log folder under `Production/logs`.
