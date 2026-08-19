# Production Supabase: one remaining fix (database host port)

## What the latest output proves

Production is up and healthy. Nothing else is broken.

- `curl http://127.0.0.1:8010/auth/v1/health` → **401 "No API key found in request"** from
  `kong/3.9.3`. That is a **healthy** Kong: it answered and demanded an API key. It is not an error.
  To get 200, send the key:
  `curl -i -H "apikey: <PRODUCTION_ANON_KEY>" http://127.0.0.1:8010/auth/v1/health`
- Studio answered **200 OK** with `"name":"RESL Approvals Production"`, `status ACTIVE_HEALTHY`.
  Studio works — reach it at `http://127.0.0.1:3100` on the server (or via nginx `/studio/`).
- Rendered config is correct for Kong (`8010 -> 8000`, `8453 -> 8443`) and Studio (`3100 -> 3000`).

The one real defect, visible at rendered line 513:

```
        published: "5432"      <-- pooler host port
        target: 5432
```

The pooler publishes host port **5432**, because the compose file uses `${POSTGRES_PORT}` for the host
side. 5432 is Quality's Postgres port, so nothing is listening on 5442 — hence
`connection to server at "127.0.0.1", port 5442 failed: Connection refused`.

## The fix

In `/data/webapplication/resl_approval/Production/backend/.env`, keep the internal port and add a
separate host port:

```
POSTGRES_PORT=5432
POSTGRES_PORT_EXT=5442
POOLER_PROXY_PORT_TRANSACTION=6553
```

In `docker-compose.yml`, change only the first `supavisor` port entry (around line 549):

```yaml
  supavisor:
    ports:
      - 127.0.0.1:${POSTGRES_PORT_EXT}:5432
      - 127.0.0.1:${POOLER_PROXY_PORT_TRANSACTION}:6543
```

Leave every other `${POSTGRES_PORT}` alone — `DB_PORT`, `PG_META_DB_PORT`, `PGPORT`, and all
connection strings must stay 5432 because that is the port inside the containers.

Apply it:

```bash
docker compose -p resl_production --env-file .env config | grep -n -B2 -A3 'published: "5442"'
docker compose -p resl_production --env-file .env up -d supavisor
docker compose -p resl_production ps supavisor
```

## Verify separate databases

```bash
psql "postgresql://postgres:<PRODUCTION_PASSWORD>@127.0.0.1:5442/postgres" \
  -c 'select current_database(), inet_server_port();'
```

Prove the two are distinct by writing a marker into Production only and confirming it is absent from
Quality on 5432.

## Separate URLs to use from now on

| Purpose | Quality | Production |
| --- | --- | --- |
| API (Kong) | `http://10.150.150.130:8000` | `http://10.150.150.130:8010` |
| Database (psql) | `...@127.0.0.1:5432/postgres` | `...@127.0.0.1:5442/postgres` |
| Pooler | `127.0.0.1:6543` | `127.0.0.1:6553` |
| Studio | `http://127.0.0.1:3000` | `http://127.0.0.1:3100` |
| App via nginx | `http://10.150.150.130:8081` | `http://10.150.150.130:9091` |

Port 8010 is the API gateway, not a database UI — a browser hitting it will always show the
"No API key found" JSON. Use Studio on 3100 (through nginx `/studio/` with basic auth) for the
database screens, and keep it bound to `127.0.0.1`.

Production frontend `.env`: `SUPABASE_URL` and `VITE_SUPABASE_URL` = `http://10.150.150.130:8010`.

## Realtime (optional, last)

```bash
docker compose -p resl_production logs --tail=80 realtime
```

`invalid JWT` / `JWSError` means `ANON_KEY` / `SERVICE_ROLE_KEY` were not minted from Production's
`JWT_SECRET`. The app does not use realtime, so this does not block anything.

No application code changes are required.
