# Why Production/backend is different from Quality/backend

Your two screenshots actually prove the opposite of "same as Quality":

| | Quality/backend | Production/backend |
| --- | --- | --- |
| `docker-compose.yml` size | **22 KB** | small middleware file |
| `grep -c 'build:'` | 0 | **1** |
| first service | `studio` / `supabase-studio` | `sap-middleware-prod` |

The repo's Supabase stack (`supabase/docker-compose.yml`) is ~22 KB with **0** `build:` lines — that
matches Quality exactly. Production's file has a `build:` for `sap-middleware-prod`, which is why the
command tried to build a Docker image and hit Docker Hub. The Supabase stack never builds anything.

So it is not "move it to middleware because I say so" — Production's `backend/docker-compose.yml` simply
got **overwritten** with the middleware compose file (pasted in with `nano`). Quality's backend file was
never touched, which is why Quality works.

Also note: Quality's `middleware/` folder has **no** `docker-compose.yml` at all — so Quality's middleware
is not run by compose in that folder. Whatever Quality does (pm2, or the repo-root compose), Production
should do the same. No compose file is needed in `Production/middleware/`.

## Step 1 — restore the Supabase stack in Production/backend

Copy from Quality (identical file; only `.env` differs):

```bash
cd /data/webapplication/resl_approval/Production/backend
mv docker-compose.yml docker-compose.middleware.yml.bak     # keep the pasted middleware file aside
cp /data/webapplication/resl_approval/Quality/backend/docker-compose.yml .
grep -c 'build:' docker-compose.yml        # must print 0
grep -m1 -A2 '^services:' docker-compose.yml   # must print studio / supabase-studio
```

## Step 2 — sanity-check the env, then start (no `--build`)

```bash
ls -l .env && grep -E '^(KONG_HTTP_PORT|KONG_HTTPS_PORT|STUDIO_PORT|POSTGRES_PORT|POOLER_PROXY_PORT_TRANSACTION)=' .env
ls -A volumes/db/data 2>/dev/null | head        # must be empty, else you inherit data
docker compose -p resl_production --env-file .env config >/dev/null && echo CONFIG_OK
docker compose -p resl_production --env-file .env up -d
docker compose -p resl_production ps
docker compose ls        # should list resl_quality AND resl_production
curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8010/auth/v1/health
```

Expected ports from your map: Kong 8010/8453, Studio 3100, Postgres 5442, pooler 6553.

All Supabase images are already on this box because Quality runs them, so no registry access is needed —
that is why dropping `--build` also fixes the `node:22-alpine` timeout.

## Step 3 — how to run the Production middleware (match Quality)

First find out how Quality runs it:

```bash
pm2 ls
docker ps --format '{{.Names}}\t{{.Ports}}' | grep -i middle
```

- If Quality's middleware is a **pm2** process, do the same for Production (no Docker, no image pull):

```bash
cd /data/webapplication/resl_approval/Production/middleware
npm install --omit=dev
PORT=3010 pm2 start server.js --name Prod_MW --time && pm2 save
curl -i http://127.0.0.1:3010/__health
```

- If Quality's middleware is a **container**, then Production needs the same image. Docker Hub is
  unreachable from this box (`registry-1.docker.io` i/o timeout), so build only works if `node:22-alpine`
  is already local:

```bash
docker images node        # 22-alpine present?
# if missing, on a machine with internet:
docker pull node:22-alpine && docker save node:22-alpine -o node22alpine.tar
# then on ReAprMatrix:
docker load -i node22alpine.tar
cd /data/webapplication/resl_approval/Production/middleware
docker compose -f docker-compose.middleware.yml -p resl_production_mw up -d --build
```

Either way the middleware `.env` in that folder needs `PORT=3010`,
`SUPABASE_URL=http://10.150.150.130:8010`, the Production service-role key, and a
`MIDDLEWARE_SHARED_SECRET` that matches the `proxy_secret` row in `public.sap_global_settings`.

## Notes

- Keep `-p resl_production` on every compose command in this folder so it never collides with Quality.
- No application code changes are involved.
