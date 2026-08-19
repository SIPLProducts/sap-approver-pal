# Fix: `Production/backend/docker-compose.yml` was overwritten with the middleware file

## What the output proves

```
grep -c 'build:' docker-compose.yml      -> 1
grep -A2 '^services:'                    -> sap-middleware-prod / build:
ls                                       -> "docker-compose."   <- stray file
```

The repo's real Supabase stack (`supabase/docker-compose.yml`) has **0** `build:` lines and its first
service is `studio` / `container_name: supabase-studio`. So the file now sitting in
`Production/backend/docker-compose.yml` is the middleware compose file — it replaced the Supabase stack
when it was pasted in with `nano`. The stray `docker-compose.` (no extension) is very likely the original
Supabase stack saved under a mistyped name.

Quality is **not** the same: Quality's `backend/docker-compose.yml` is the Supabase stack, and its
middleware lives in `Quality/middleware/`. Verify that yourself:

```bash
grep -c 'build:' /data/webapplication/resl_approval/Quality/backend/docker-compose.yml   # expect 0
```

## Step 1 — check the stray file

```bash
cd /data/webapplication/resl_approval/Production/backend
ls -l docker-compose.
grep -c 'build:' docker-compose.            # 0 = it IS the Supabase stack
grep -m1 -A2 '^services:' docker-compose.   # expect studio / supabase-studio
```

## Step 2 — restore the correct layout

If Step 1 confirms the stray file is the Supabase stack:

```bash
mv docker-compose.yml ../middleware/docker-compose.yml   # middleware file to where it belongs
mv docker-compose. docker-compose.yml                    # restore the Supabase stack
```

If the stray file is not the stack, copy it fresh from Quality (identical file, only `.env` differs):

```bash
cp /data/webapplication/resl_approval/Quality/backend/docker-compose.yml .
```

Then confirm:

```bash
grep -c 'build:' docker-compose.yml        # must be 0
docker compose -p resl_production --env-file .env config >/dev/null && echo OK
```

## Step 3 — start the backend (no `--build`)

The Supabase stack only pulls images; `--build` is what dragged Docker Hub into it.

```bash
docker compose -p resl_production --env-file .env up -d
docker compose -p resl_production ps
docker compose ls          # should list resl_quality AND resl_production
curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8010/auth/v1/health
```

All the Supabase images are already local because Quality runs them, so no registry access is needed.

## Step 4 — the middleware, without Docker Hub

`Production/middleware/` already has the sources **and `node_modules/`**. Docker Hub is unreachable from
this box (`dial tcp 98.87.63.243:443: i/o timeout` on `registry-1.docker.io`), so building the image is
blocked. Run it under pm2 instead — same behaviour, no image pull:

```bash
cd /data/webapplication/resl_approval/Production/middleware
npm install --omit=dev
PORT=3010 pm2 start server.js --name Prod_MW --time && pm2 save
curl -i http://127.0.0.1:3010/__health
```

Its `.env` in that folder needs `PORT=3010`, `SUPABASE_URL=http://10.150.150.130:8010`, the Production
service-role key, and a `MIDDLEWARE_SHARED_SECRET` that matches the `proxy_secret` row in
`public.sap_global_settings`.

If you'd rather keep it in Docker later, either fix Docker's proxy config or load the base image offline:

```bash
docker images node                 # 22-alpine already present?
# on a machine with internet:
docker pull node:22-alpine && docker save node:22-alpine -o node22alpine.tar
# on ReAprMatrix:
docker load -i node22alpine.tar && docker compose -p resl_production up -d --build
```

## Notes

- No application code changes are involved in any of this.
- Before Step 3, confirm `volumes/db/data` in `Production/backend` is empty, otherwise Production would
  come up on Quality's data.
