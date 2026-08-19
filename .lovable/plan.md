# Why `10.150.150.130:8010` refuses to connect

Two separate problems, both visible in your `docker compose ps` output.

## Problem 1 — the port mappings point at the wrong container ports

```
supabase-prod-kong     8000-8004/tcp, 127.0.0.1:8010->8010/tcp, 8443-8447/tcp, 127.0.0.1:8453->8453/tcp
supabase-prod-studio   3000/tcp, 127.0.0.1:3100->3100/tcp
supabase-prod-pooler   127.0.0.1:5432->5432/tcp, 127.0.0.1:6553->6543/tcp
```

Kong listens on **8000** inside the container and Studio on **3000**. The mappings forward host 8010 to
container **8010** and host 3100 to container **3100** — nothing is listening there, so the connection is
dead even from the host. Compare with the repo file, which is correct:

```yaml
kong:
  ports:
    - 127.0.0.1:${KONG_HTTP_PORT}:8000/tcp     # right side stays 8000
    - 127.0.0.1:${KONG_HTTPS_PORT}:8443/tcp    # right side stays 8443
studio:
  ports:
    - 127.0.0.1:${STUDIO_PORT}:3000/tcp        # right side stays 3000
```

Only the **left** (host) side is env-driven. Somebody edited the right side too. Pooler shows the same
symptom pattern in reverse: its transaction mapping `6553->6543` is right, but session `5432->5432` is the
default — that collides with Quality's Postgres unless Quality uses a different host port.

Fix: restore the stack file so the container-side ports are the originals and only host ports come from
`.env`.

```bash
cd /data/webapplication/resl_approval/Production/backend
cp docker-compose.yml docker-compose.yml.bak
cp /data/webapplication/resl_approval/Quality/backend/docker-compose.yml .
grep -n 'POSTGRES_PORT\|KONG_HTTP_PORT\|STUDIO_PORT\|POOLER_PROXY' docker-compose.yml
```

Then set the host ports in `.env` only:

```
KONG_HTTP_PORT=8010
KONG_HTTPS_PORT=8453
STUDIO_PORT=3100
POSTGRES_PORT=5442
POOLER_PROXY_PORT_TRANSACTION=6553
```

Note `POSTGRES_PORT` is used **both** as the pooler's host port and as Postgres' internal `PGPORT` in this
stack, so it must match what Quality does — check Quality's `.env` value and pick a free one (5442) for
Production.

Recreate and confirm the right side is back to the container defaults:

```bash
docker compose -p resl_production --env-file .env up -d
docker compose -p resl_production ps
# expect: 127.0.0.1:8010->8000/tcp   and   127.0.0.1:3100->3000/tcp
curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8010/auth/v1/health
curl -sI http://127.0.0.1:3100 | head -n1
```

## Problem 2 — ports are bound to 127.0.0.1 on purpose

Even once fixed, `http://10.150.150.130:8010` will still refuse. Every published port in this stack is
bound to `127.0.0.1` deliberately, so Kong and Studio are not exposed on the LAN. Quality behaves the
same way — you reach it through nginx, not directly.

So Production is reached through the nginx vhost on **9091**:

- app: `http://10.150.150.130:9091/`
- backend API: `http://10.150.150.130:9091/supabase/`
- Studio: `http://10.150.150.130:9091/studio/` (basic auth)

The frontend `.env` you pasted has `VITE_SUPABASE_URL=http://10.150.150.130:8010`, which the **browser**
cannot reach for the same reason. It must point at the nginx path that proxies Kong, matching how Quality
is configured — check Quality's frontend `.env` value and mirror the pattern with the 9091 host.

## Problem 3 — realtime is unhealthy

```
realtime-prod.supabase-realtime  Up 20 minutes (unhealthy)
```

Almost always a key/secret mismatch. Check:

```bash
docker compose -p resl_production logs --tail=80 realtime
```

- `invalid JWT` / `JWSError` → `ANON_KEY` / `SERVICE_ROLE_KEY` were not minted from this `JWT_SECRET`.
- `REALTIME_DB_ENC_KEY` errors → must be exactly 16 characters.
- `SECRET_KEY_BASE` errors → regenerate with `openssl rand -hex 32`.

The app itself does not depend on realtime, so this can be fixed after the rest is up.

## Order to run

1. Restore `docker-compose.yml` from Quality; put the host ports only in `.env`.
2. `up -d`, confirm `8010->8000` and `3100->3000`, curl both on 127.0.0.1.
3. Install the nginx 9091 vhost and browse via 9091 — not 8010.
4. Point the frontend `.env` backend URL at the 9091 proxy path (mirror Quality).
5. Then chase the realtime logs.

No application code changes are involved.
