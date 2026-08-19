# Production environment: ports, nginx, docker, backend

## Answer first: are ports hardcoded?

The **application code** hardcodes no port. Everything is env-driven:

- App server: `PORT` / `HOST` (read at runtime by `dist/start.mjs`).
- Backend (database/auth) URL: `SUPABASE_URL` / `VITE_SUPABASE_URL` — so `:8000` (Quality) vs `:8010` (Production) is env-driven.
- SAP middleware: taken from the DB row in **Admin → SAP API Settings → Middleware Configuration**, with `MIDDLEWARE_URL` in `.env` as server-side fallback. The `3002` in code is only the pre-filled default in that form.

Two **scripts** do bake Quality values in, and they are the only things that break a second instance on the same box:

1. `scripts/collect-dist.mjs` always writes `PORT=8080` / `HOST=0.0.0.0` into `dist/.env.runtime`, so `PORT=8090` in the Production frontend `.env` is ignored.
2. `scripts/deploy-frontend.sh` defaults to port `8080` and health-checks fixed `8000`, `3002`, `8081`.

## Production port map (as given)

```text
9091 → Nginx        external
8090 → SSR app      localhost
8010 → Kong HTTP    localhost
8453 → Kong HTTPS   localhost
3010 → Middleware   localhost
3100 → Studio       localhost
```

## Script fixes (no app-logic changes)

1. `scripts/collect-dist.mjs`: honour `PORT`, `HOST`, `NODE_ENV` from the frontend `.env` / process env; keep `8080` / `0.0.0.0` only as fallbacks.
2. `scripts/deploy-frontend.sh`: derive health-check targets from `.env.runtime` (`PORT`, `SUPABASE_URL`, `MIDDLEWARE_URL`) plus an optional `--nginx-port` flag, instead of the fixed 8080/8000/3002/8081.

## New Production files

3. `deploy/production/nginx/resl-approval-production-9091.conf` — mirror of the Quality vhost with Production upstreams: `listen 9091`, app server `127.0.0.1:8090`, Kong `127.0.0.1:8010`, Studio `127.0.0.1:3100`, middleware `127.0.0.1:3010`; same `location /` SSR proxy, `/assets/`, `/sw.js`, `/manifest.webmanifest`, `/_serverFn/`, `/api/`, `/supabase/`, `/studio/` (basic auth), `/mw/` blocks; logs under `/data/webapplication/resl_approval/Production/logs/`.
4. `deploy/production/frontend/.env.example` — the exact frontend `.env` for Production: `VITE_SUPABASE_URL=http://10.150.150.130:8010`, matching `SUPABASE_*`, `MIDDLEWARE_URL=http://127.0.0.1:3010`, `PORT=8090`, `HOST=127.0.0.1`, `NODE_ENV=production`.
5. `deploy/production/middleware/.env.example` + `deploy/production/middleware/docker-compose.yml` — Production middleware container only: `PORT=3010`, host port `3010`, `APP_BASE_URL=http://10.150.150.130:9091`, compose project `resl_production` so it never shares containers/networks with Quality.
6. `deploy/production/backend/.env.example` — Supabase self-host env for `Production/backend`: `KONG_HTTP_PORT=8010`, `KONG_HTTPS_PORT=8453`, `STUDIO_PORT=3100`, distinct `POSTGRES_PORT`/`POOLER_PROXY_PORT_TRANSACTION`, own `POSTGRES_PASSWORD`, `JWT_SECRET`, `DASHBOARD_USERNAME/PASSWORD`, `SITE_URL=http://10.150.150.130:9091`, `API_EXTERNAL_URL=http://10.150.150.130:8010`.
7. `DEPLOY-PRODUCTION.md` — end-to-end runbook: copy the repo `supabase/` stack into `Production/backend`, apply the env above, `docker compose -p resl_production --env-file .env up -d`, apply the schema + seed SQL (`scripts/quality-seed-*.sql` re-pointed at Production) via Studio/psql, build the frontend with `npm run build:selfhost`, deploy `dist/` into `Production/frontend`, run `deploy-frontend.sh --port 8090 --nginx-port 9091` under pm2 name `Prod_App`, install the nginx conf, then set the Production middleware URL/secret in SAP API Settings.

## Note on the keys you pasted

The Production `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` are the **same JWTs as Quality**, i.e. one shared `JWT_SECRET`, so a Quality token would be accepted by Production. The runbook includes generating a fresh Production `JWT_SECRET` with matching anon/service keys; you can keep the shared keys if you prefer — say so and I'll drop that step.
