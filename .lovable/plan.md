# Production Supabase: fix Kong port mapping, container names, and separate URLs

Your analysis is correct: `HOST:CONTAINER`. Kong listens on **8000** inside the container, Studio on
**3000**. Mapping `8010:8010` / `3100:3100` forwards to a port nothing listens on, which is the
`Connection reset by peer`. Three things must be fixed together, otherwise `up -d` keeps failing.

## 1. Port mappings (host side unique, container side fixed)

In `/data/webapplication/resl_approval/Production/backend/docker-compose.yml`:

```yaml
  kong:
    ports:
      - 0.0.0.0:${KONG_HTTP_PORT}:8000/tcp
      - 0.0.0.0:${KONG_HTTPS_PORT}:8443/tcp

  studio:
    ports:
      - 127.0.0.1:${STUDIO_PORT}:3000/tcp
```

Pooler / db (host side must not be Quality's 5432):

```yaml
  supavisor:
    ports:
      - 127.0.0.1:${POSTGRES_PORT_EXT}:5432/tcp
      - 127.0.0.1:${POOLER_PROXY_PORT_TRANSACTION}:6543/tcp
```

`.env` for Production:

```
KONG_HTTP_PORT=8010
KONG_HTTPS_PORT=8453
STUDIO_PORT=3100
POSTGRES_PORT=5432          # container-internal, keep 5432
POSTGRES_PORT_EXT=5442      # host-side
POOLER_PROXY_PORT_TRANSACTION=6553
```

## 2. Container names still collide with Quality

The earlier failure was:

```
Conflict. The container name "/supabase-imgproxy" is already in use
```

`-p resl_production` isolates networks/volumes but **not** hardcoded `container_name:`. Rename every
one that isn't already `-prod`:

```bash
cd /data/webapplication/resl_approval/Production/backend
cp docker-compose.yml docker-compose.yml.bak
sed -i -E 's/container_name: supabase-(prod-)?/container_name: supabase-prod-/' docker-compose.yml
sed -i -E 's/container_name: realtime-dev\.[A-Za-z0-9_-]+/container_name: realtime-prod.supabase-realtime/' docker-compose.yml
grep -n 'container_name:' docker-compose.yml    # every name must carry -prod
```

## 2b. Remove the orphaned containers left from the old project name

`down` only removed the network, so the containers created earlier (under a different compose project
label, or already renamed to `-prod` by the sed) survive and still own the names. Docker refuses to
reuse `/supabase-prod-imgproxy` because that old container object still exists — it is not Quality's.

List and remove them by name pattern:

```bash
docker ps -a --filter 'name=supabase-prod' --format '{{.ID}}  {{.Names}}  {{.Label "com.docker.compose.project"}}'
docker ps -a --filter 'name=realtime-prod' --format '{{.ID}}  {{.Names}}  {{.Label "com.docker.compose.project"}}'
```

Confirm every line is a `-prod` name (never a bare `supabase-<svc>` — that is Quality), then:

```bash
docker rm -f $(docker ps -aq --filter 'name=supabase-prod') $(docker ps -aq --filter 'name=realtime-prod')
docker ps -a --filter 'name=prod' --format '{{.Names}}'    # must be empty
```

Removing containers does not touch volumes, so the Production database data survives.



## 3. Recreate cleanly

Stale containers created from the old file keep the wrong mappings; `--force-recreate kong` alone is
not enough once names changed.

```bash
docker compose -p resl_production --env-file .env config >/dev/null && echo CONFIG_OK
docker compose -p resl_production --env-file .env down
docker compose -p resl_production --env-file .env up -d
docker compose -p resl_production ps
```

Quality is untouched — it runs under its own project name. Confirm with its own `ps` before and after.

Expected right-hand sides:

```
supabase-prod-kong     0.0.0.0:8010->8000/tcp
supabase-prod-studio   127.0.0.1:3100->3000/tcp
supabase-prod-pooler   127.0.0.1:5442->5432/tcp, 127.0.0.1:6553->6543/tcp
```

## 4. Separate URLs per environment

Two fully distinct sets — nothing shared:

| Purpose | Quality | Production |
| --- | --- | --- |
| API (Kong) | `http://10.150.150.130:8000` | `http://10.150.150.130:8010` |
| Studio | `http://127.0.0.1:3000` | `http://127.0.0.1:3100` |
| App via nginx | `http://10.150.150.130:8081` | `http://10.150.150.130:9091` |
| Postgres (psql) | `postgresql://postgres:<QTY_PW>@127.0.0.1:5432/postgres` | `postgresql://postgres:<PROD_PW>@127.0.0.1:5442/postgres` |
| Pooler | `127.0.0.1:6543` | `127.0.0.1:6553` |

Backend `.env` (Production) must therefore read:

```
API_EXTERNAL_URL=http://10.150.150.130:8010
SUPABASE_PUBLIC_URL=http://10.150.150.130:8010
SITE_URL=http://10.150.150.130:9091
```

and the frontend `.env`: `VITE_SUPABASE_URL=http://10.150.150.130:8010` (browser-reachable host, not
`127.0.0.1`).

## 5. Verify

```bash
curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8010/auth/v1/health       # 200
curl -o /dev/null -w '%{http_code}\n' http://10.150.150.130:8010/auth/v1/health  # 200 from LAN
ss -ltnp | grep -E ':8010|:3100|:5442|:6553'
psql "postgresql://postgres:<PROD_PW>@127.0.0.1:5442/postgres" -c 'select current_database();'
```

Studio is localhost-only by design; reach Production Studio through the nginx 9091 vhost
(`/studio/`, basic auth) or an SSH tunnel — not directly over the LAN.

## Then realtime

```bash
docker compose -p resl_production logs --tail=80 realtime
```

- `invalid JWT` / `JWSError` → `ANON_KEY` / `SERVICE_ROLE_KEY` were not minted from Production's `JWT_SECRET`.
- `REALTIME_DB_ENC_KEY` must be exactly 16 chars; regenerate `SECRET_KEY_BASE` with `openssl rand -hex 32`.

The app does not use realtime, so settle this after Kong and Studio answer.

No application code changes are involved — this is server configuration only.
