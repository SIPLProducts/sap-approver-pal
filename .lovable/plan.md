# Fix the Production stack collisions with Quality

Two separate problems are visible in that output.

## Problem 1 — container names collide with Quality

```
Conflict. The container name "/supabase-imgproxy" is already in use
```

The `-p resl_production` project name isolates networks and volumes, but **not** services that hardcode
`container_name:`. Quality already owns `supabase-imgproxy`, so Production cannot create its own.
The services that did come up (`supabase-prod-db`, `supabase-prod-kong`, …) already carry a `-prod`
name, so only the leftover un-prefixed ones are conflicting.

Find them all:

```bash
cd /data/webapplication/resl_approval/Production/backend
grep -n 'container_name:' docker-compose.yml
```

Every line that is not already `-prod` (imgproxy, and likely analytics/vector/functions/supavisor) must be
renamed, e.g. `container_name: supabase-prod-imgproxy`. Do it in one pass:

```bash
cp docker-compose.yml docker-compose.yml.bak
sed -i -E 's/container_name: supabase-(prod-)?/container_name: supabase-prod-/' docker-compose.yml
sed -i -E 's/container_name: realtime-dev\.[A-Za-z0-9_-]+/container_name: realtime-prod.supabase-realtime/' docker-compose.yml
grep -n 'container_name:' docker-compose.yml   # confirm every name has -prod
```

## Problem 2 — stale containers still hold the wrong ports

`kong` shows `127.0.0.1:8010->8010` and `studio` shows `127.0.0.1:3100->3100`. Those are containers created
16 and 26 minutes ago, from the *old* broken compose file — the restored file was never applied to them.
`pooler` is also on `127.0.0.1:5432->5432`, which is Quality's Postgres port.

So the whole project needs to be torn down and recreated, and `POSTGRES_PORT` must move off 5432:

```bash
grep -E '^(KONG_HTTP_PORT|STUDIO_PORT|POSTGRES_PORT|POOLER_PROXY_PORT_TRANSACTION)=' .env
```

Production values:

```
KONG_HTTP_PORT=8010
STUDIO_PORT=3100
POSTGRES_PORT=5442
POOLER_PROXY_PORT_TRANSACTION=6553
```

Then:

```bash
docker compose -p resl_production --env-file .env down
docker compose -p resl_production --env-file .env config >/dev/null && echo CONFIG_OK
docker compose -p resl_production --env-file .env up -d
docker compose -p resl_production ps
```

`down` only removes Production's own containers — Quality is untouched because it runs under its own
project name. Confirm that first with `docker compose -p resl_quality ps` (or whatever name Quality uses)
before and after.

## Expected result

The right-hand side of each mapping is what proves the restored file took effect:

```
supabase-prod-kong     0.0.0.0:8010->8000/tcp
supabase-prod-studio   127.0.0.1:3100->3000/tcp
supabase-prod-pooler   127.0.0.1:5442->5432/tcp, 127.0.0.1:6553->6543/tcp
```

Verify:

```bash
curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8010/auth/v1/health      # 200
curl -o /dev/null -w '%{http_code}\n' http://10.150.150.130:8010/auth/v1/health # 200 from LAN
ss -ltnp | grep -E ':8010|:3100|:5442|:6553'
```

If 8010 still refuses from the LAN, check the kong `ports:` line — Quality's file binds it to `0.0.0.0`;
if yours says `127.0.0.1`, change that one entry to `0.0.0.0` (or reach the app only through Nginx on 9091).

## Then realtime

```bash
docker compose -p resl_production logs --tail=80 realtime
```

- `invalid JWT` / `JWSError` → `ANON_KEY` / `SERVICE_ROLE_KEY` were not minted from this `JWT_SECRET`.
- `REALTIME_DB_ENC_KEY` must be exactly 16 characters; regenerate `SECRET_KEY_BASE` with `openssl rand -hex 32`.

The app does not use realtime, so this can be settled after Kong and Studio respond.

No application code changes are involved.
