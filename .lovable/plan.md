# Production environment: ports, nginx, docker, backend

## Answer first: are ports hardcoded?

The **application code** does not hardcode any port. Everything comes from environment variables:

- App server port/host: `PORT` / `HOST` (read at runtime by `dist/start.mjs`).
- Backend (database/auth) URL: `SUPABASE_URL` / `VITE_SUPABASE_URL` — so `:8000` (Quality) vs `:8010` (Production) is env-driven.
- SAP middleware URL/port: taken from the database row in **Admin → SAP API Settings → Middleware Configuration** (`middleware_url`, `middleware_port`), with `MIDDLEWARE_URL` in `.env` as the server-side fallback. The `3002` you see in code is only the pre-filled default value in that form.

Two build/deploy **scripts** do hardcode Quality-style values, and these are the only things that will bite a second (Production) instance on the same box:

1. `scripts/collect-dist.mjs` always writes `PORT=8080` and `HOST=0.0.0.0` into `dist/.env.runtime`, so a `PORT=8090` in your frontend `.env` is ignored.
2. `scripts/deploy-frontend.sh` defaults to port `8080` and health-checks fixed `8000` (gateway), `3002` (middleware) and `8081` (nginx), so a Production run prints misleading warnings.

## What to change (small, no app-logic changes)

1. `scripts/collect-dist.mjs`: honour `PORT`, `HOST`, `NODE_ENV` from the frontend `.env` (or process env) instead of forcing `8080` / `0.0.0.0`; keep the current values only as fallbacks.
2. `scripts/deploy-frontend.sh`: derive the health-check targets from `.env.runtime` (`PORT`, `SUPABASE_URL`, `MIDDLEWARE_URL`) and an optional `--nginx-port` flag, instead of the fixed 8080/8000/3002/8081.

## New files to add for Production

3. `deploy/production/nginx/resl-approval-production-8091.conf` — mirror of the Quality vhost with Production upstreams:
   - `listen 8091` (Quality uses 8081)
   - app server `127.0.0.1:8090`
   - Supabase API gateway `127.0.0.1:8010`
   - Supabase Studio `127.0.0.1:3010` (Studio for the Production stack)
   - SAP middleware `127.0.0.1:3010`… note: your Production `MIDDLEWARE_URL` is `:3010`, which collides with a Studio-on-3010 choice — see the question below.
   - same `location /` → SSR proxy rule, `/assets/`, `/sw.js`, `/manifest.webmanifest`, `/_serverFn/`, `/api/`, `/supabase/`, `/studio/`, `/mw/` blocks and log paths under `/data/webapplication/resl_approval/Production/logs/`.
4. `.env.frontend.production.example` — the exact Production frontend `.env` template using the values you pasted (`:8010`, `PORT=8090`, `MIDDLEWARE_URL=http://127.0.0.1:3010`, `NODE_ENV=production`).
5. `deploy/production/middleware/.env.production.example` + a `deploy/production/docker-compose.yml` for the Production middleware container only (`PORT=3010`, host port `3010`, `APP_BASE_URL=http://10.150.150.130:8091`, project name `resl_production` so it never shares containers/networks with Quality).
6. `deploy/production/supabase/.env.production.example` + `DEPLOY-PRODUCTION.md` — step-by-step: copy `supabase/` into `Production/backend`, set `POSTGRES_PORT`, `KONG_HTTP_PORT=8010`, `STUDIO_PORT`, distinct `POSTGRES_PASSWORD`, `JWT_SECRET` (with matching anon/service keys), distinct volume paths, and run with `docker compose -p resl_production --env-file .env up -d`. Includes the frontend build/deploy sequence and how to seed SAP API settings for Production.

## Note on the keys you pasted

The Production `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` are the **same JWTs as Quality**, which means both stacks share one `JWT_SECRET`. A Quality token would then be accepted by Production. The plan generates a fresh `JWT_SECRET` + anon/service keys for Production and documents it; tell me if you want to keep the shared keys instead.

## Question before I build

Production `MIDDLEWARE_URL` is `http://127.0.0.1:3010`. Should Production Supabase Studio use a different port (e.g. `3011`) to avoid the clash, or is the middleware port meant to be something else?
