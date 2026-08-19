# Recover the separate Production database stack

## Confirmed from the uploaded compose file

- Production Kong is already correct: `0.0.0.0:${KONG_HTTP_PORT}:8000` (lines 89–91).
- Production Studio is correctly mapped internally to port 3000, but is intentionally reachable only
  from the server: `127.0.0.1:${STUDIO_PORT}:3000` (line 23).
- Production container names are consistently prefixed `supabase-prod-*`.
- The immediate startup failure is an **orphaned old Production container** still owning
  `/supabase-prod-imgproxy`. `docker compose ... down` removed only the current project network and
  did not remove that old container.
- The Production pooler currently maps `${POSTGRES_PORT}:5432` (line 549). That incorrectly reuses
  the internal database variable as a host port and can collide with Quality. It must use a separate
  Production host-port variable.

## 1. Remove only orphaned Production containers

First inspect their compose labels:

```bash
cd /data/webapplication/resl_approval/Production/backend

docker ps -a --filter 'name=supabase-prod' \
  --format '{{.ID}}  {{.Names}}  project={{.Label "com.docker.compose.project"}}'
docker ps -a --filter 'name=realtime-prod' \
  --format '{{.ID}}  {{.Names}}  project={{.Label "com.docker.compose.project"}}'
```

Every returned name must contain `-prod`. Do **not** remove bare Quality names such as
`supabase-imgproxy`, `supabase-db`, or `supabase-kong`.

Then remove the stale Production container objects:

```bash
docker ps -aq --filter 'name=supabase-prod' | xargs -r docker rm -f
docker ps -aq --filter 'name=realtime-prod' | xargs -r docker rm -f
```

This removes containers only. It does not delete the bind-mounted Production database at
`Production/backend/volumes/db/data`.

## 2. Give Production PostgreSQL its own host port

Keep the internal database port unchanged:

```text
POSTGRES_PORT=5432
POSTGRES_PORT_EXT=5442
POOLER_PROXY_PORT_TRANSACTION=6553
```

Change only the first `supavisor.ports` entry in the Production compose:

```yaml
  supavisor:
    ports:
      - 127.0.0.1:${POSTGRES_PORT_EXT}:5432
      - 127.0.0.1:${POOLER_PROXY_PORT_TRANSACTION}:6543
```

Do not replace internal uses such as `DB_PORT`, `PG_META_DB_PORT`, or database connection strings;
containers must continue talking to PostgreSQL on internal port 5432.

## 3. Validate the rendered configuration before starting

```bash
docker compose -p resl_production --env-file .env config > /tmp/resl-production-compose.txt
grep -n -A4 -E 'container_name: supabase-prod-(kong|studio|pooler)' /tmp/resl-production-compose.txt
grep -n -A4 'published:' /tmp/resl-production-compose.txt
```

The rendered mappings must resolve to:

```text
Kong:    0.0.0.0:8010 -> 8000
Studio:  127.0.0.1:3100 -> 3000
DB:      127.0.0.1:5442 -> 5432
Pooler:  127.0.0.1:6553 -> 6543
```

## 4. Start Production and check health

```bash
docker compose -p resl_production --env-file .env up -d
docker compose -p resl_production --env-file .env ps

curl -i http://127.0.0.1:8010/auth/v1/health
curl -i http://127.0.0.1:3100/api/platform/profile
psql "postgresql://postgres:<PRODUCTION_PASSWORD>@127.0.0.1:5442/postgres" \
  -c 'select current_database(), inet_server_port();'
```

If a service is not healthy:

```bash
docker compose -p resl_production --env-file .env logs --tail=100 db kong studio supavisor
```

## 5. Use the correct separate Production URLs

These are different endpoints with different purposes:

| Purpose | Production endpoint |
| --- | --- |
| Application/backend API | `http://10.150.150.130:8010` |
| Database connection on server | `postgresql://postgres:<PROD_PASSWORD>@127.0.0.1:5442/postgres` |
| Studio UI on server | `http://127.0.0.1:3100` |
| Studio UI from LAN | `http://10.150.150.130:9091/studio/` through nginx |
| Production application | `http://10.150.150.130:9091` |

Port 8010 is the backend API, not the database administration screen. Opening
`http://10.150.150.130:3100` from another machine cannot work while Studio is bound to `127.0.0.1`.
Keep it private and use the nginx `/studio/` route with basic authentication, rather than exposing
Studio directly on `0.0.0.0`.

Production frontend environment:

```text
SUPABASE_URL=http://10.150.150.130:8010
VITE_SUPABASE_URL=http://10.150.150.130:8010
```

Production backend environment:

```text
API_EXTERNAL_URL=http://10.150.150.130:8010
SUPABASE_PUBLIC_URL=http://10.150.150.130:8010
SITE_URL=http://10.150.150.130:9091
```

Quality remains on its own ports and its bare `supabase-*` containers. Production remains isolated
through `supabase-prod-*`, its own compose project, its own `volumes/db/data`, password, JWT secret,
API keys, and host ports.

No application code changes are required.