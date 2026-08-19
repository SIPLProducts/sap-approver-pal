# Production deployment — start the stack beside Quality

Your `Production/backend/` now holds the correct Supabase self-hosted stack (`docker-compose.yml`, `volumes/`, `migrations/`, helper scripts). The compose file you pasted earlier was the **middleware** file — that one belongs in `Production/middleware/`, not `backend/`.

## Folder layout

```text
Production/
  backend/        # Supabase stack (docker-compose.yml + .env + volumes/)  <- correct now
  middleware/     # SAP middleware sources + docker-compose.yml + .env
  frontend/       # .env + dist/
  logs/           # nginx logs
  scripts/        # seed SQL
```

## 1. Backend `.env`

`Production/backend/` has no `.env` yet — the stack will not start without it.

```bash
cd /data/webapplication/resl_approval/Production/backend
cp /path/to/repo/deploy/production/backend/.env.example .env
chmod 600 .env
```

Generate the secrets:

```bash
openssl rand -hex 24   # POSTGRES_PASSWORD, DASHBOARD_PASSWORD
openssl rand -hex 32   # JWT_SECRET, SECRET_KEY_BASE, LOGFLARE_* tokens
openssl rand -hex 16   # VAULT_ENC_KEY
```

Then mint `ANON_KEY` / `SERVICE_ROLE_KEY` from that Production `JWT_SECRET` (the mint script from earlier).

Ports already set in that example: Kong `8010`/`8453`, Studio `3100`, Postgres `5442`, pooler `6553`.

## 2. Start the backend

```bash
cd /data/webapplication/resl_approval/Production/backend
docker compose -p resl_production --env-file .env up -d
docker compose -p resl_production ps
docker compose ls          # should now list resl_quality AND resl_production
```

Verify:

```bash
curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8010/auth/v1/health
curl -sI http://127.0.0.1:3100 | head -n1
```

`-p resl_production` is mandatory on **every** command in this folder — without it Docker reuses the folder-derived project name and can collide with Quality containers.

## 3. Middleware — separate folder

```bash
mkdir -p /data/webapplication/resl_approval/Production/middleware
cd /data/webapplication/resl_approval/Production/middleware
cp -r /path/to/repo/middleware/* .
cp /path/to/repo/deploy/production/middleware/docker-compose.yml .
cp /path/to/repo/deploy/production/middleware/.env.example .env
chmod 600 .env
# edit .env: MIDDLEWARE_SHARED_SECRET = long random, different from Quality
```

Because the sources are now in the same folder as the compose file, change the build context in that copied `docker-compose.yml` from `../../../middleware` to `.`, then:

```bash
docker compose -p resl_production up -d --build
curl -i http://127.0.0.1:3010/__health
```

## 4. Schema + seed

```bash
psql "postgresql://postgres:<POSTGRES_PASSWORD>@127.0.0.1:5442/postgres" -f <schema.sql>
psql "postgresql://postgres:<POSTGRES_PASSWORD>@127.0.0.1:5442/postgres" -f scripts/quality-seed-data-sql-editor.sql
```

Then point the middleware row at Production:

```sql
update public.sap_global_settings
   set connection_mode = 'via_proxy',
       middleware_port = 3010,
       middleware_url  = 'http://127.0.0.1:3010',
       proxy_secret    = '<Production MIDDLEWARE_SHARED_SECRET>'
 where name = 'default';
```

## 5. Frontend + nginx

```bash
cd /data/webapplication/resl_approval/Production/frontend
cp /path/to/repo/deploy/production/frontend/.env.example .env   # PORT=8090, Kong 8010
chmod 600 .env
cd dist && bash deploy-frontend.sh --port 8090 --nginx-port 9091

cp /path/to/repo/deploy/production/nginx/resl-approval-production-9091.conf /etc/nginx/conf.d/
htpasswd -c /etc/nginx/.htpasswd-studio-prod studioadmin
mkdir -p /data/webapplication/resl_approval/Production/logs
nginx -t && nginx -s reload
```

## Checks before you run

- `Production/backend/volumes/db/data` must be empty/absent, otherwise you inherit Quality data.
- `JWT_SECRET`, `POSTGRES_PASSWORD`, `MIDDLEWARE_SHARED_SECRET` all different from Quality.
- Every `docker compose` command in Production uses `-p resl_production`.
