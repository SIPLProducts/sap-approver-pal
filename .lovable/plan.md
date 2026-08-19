# Next: bring Production up with the restored stack file

The copied file is now correct. Your grep confirms the container-side ports are back to the originals and
only the host side is env-driven:

```
20:  - 127.0.0.1:${STUDIO_PORT}:3000/tcp
87:  - 0.0.0.0:${KONG_HTTP_PORT}:8000/tcp        <- Quality exposes Kong on the LAN
546: - 127.0.0.1:${POSTGRES_PORT}:5432
547: - 127.0.0.1:${POOLER_PROXY_PORT_TRANSACTION}:6543
```

Two things to know about this file:

- Kong is bound to `0.0.0.0`, so `http://10.150.150.130:8010` **will** work once the host port is 8010.
  There is no `KONG_HTTPS_PORT` mapping in Quality's file, so 8453 simply won't be published — that's fine.
- `POSTGRES_PORT` is used both as the pooler's host port (line 546) and as Postgres' internal `PGPORT`
  (line 523). It must be a host port that is free, i.e. **not** the value Quality uses.

## 1. Set only the host ports in `.env`

```bash
cd /data/webapplication/resl_approval/Production/backend
grep -E '^(KONG_HTTP_PORT|KONG_HTTPS_PORT|STUDIO_PORT|POSTGRES_PORT|POOLER_PROXY_PORT_TRANSACTION)=' .env
grep -E '^(POSTGRES_PORT|POOLER_PROXY_PORT_TRANSACTION)=' ../../Quality/backend/.env   # what Quality uses
```

Production values:

```
KONG_HTTP_PORT=8010
STUDIO_PORT=3100
POSTGRES_PORT=5442
POOLER_PROXY_PORT_TRANSACTION=6553
```

Also confirm the URL vars match the Production entry points:

```
SITE_URL=http://10.150.150.130:9091
API_EXTERNAL_URL=http://10.150.150.130:8010
SUPABASE_PUBLIC_URL=http://10.150.150.130:8010
```

## 2. Recreate and verify the mappings

```bash
docker compose -p resl_production --env-file .env config >/dev/null && echo CONFIG_OK
docker compose -p resl_production --env-file .env up -d
docker compose -p resl_production ps
```

Expected now (note the right-hand side):

```
kong    0.0.0.0:8010->8000/tcp
studio  127.0.0.1:3100->3000/tcp
pooler  127.0.0.1:5442->5432/tcp, 127.0.0.1:6553->6543/tcp
```

Checks:

```bash
curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8010/auth/v1/health     # 200
curl -o /dev/null -w '%{http_code}\n' http://10.150.150.130:8010/auth/v1/health # 200 from the LAN
curl -sI http://127.0.0.1:3100 | head -n1                                       # Studio, localhost only
ss -ltnp | grep -E ':8010|:3100|:5442|:6553'
```

If a port is still in use, `docker compose -p resl_production down` first, then `up -d`.

## 3. Realtime unhealthy

```bash
docker compose -p resl_production logs --tail=80 realtime
```

- `invalid JWT` / `JWSError` → `ANON_KEY` / `SERVICE_ROLE_KEY` were not minted from this `JWT_SECRET`.
- `REALTIME_DB_ENC_KEY` must be exactly 16 characters.
- `SECRET_KEY_BASE` → regenerate with `openssl rand -hex 32`.

The app does not depend on realtime, so this can wait until the rest is verified.

## 4. Then frontend + nginx

- Frontend `.env`: `VITE_SUPABASE_URL` / `SUPABASE_URL` = `http://10.150.150.130:8010`, `PORT=8090`,
  `HOST=127.0.0.1`, `MIDDLEWARE_URL=http://127.0.0.1:3010`.
- Install `deploy/production/nginx/resl-approval-production-9091.conf`, `nginx -t && nginx -s reload`.
- Middleware on 3010 (pm2 `Prod_MW`, since Docker Hub is unreachable from this box).

No application code changes are involved.
