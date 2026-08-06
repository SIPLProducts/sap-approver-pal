# Fix: backend gateway (Kong) reports unhealthy on the Quality server

`docker compose up -d` starts every backend container except the API gateway (Kong). Everything that depends on the gateway then refuses to start, so the app and Studio are unreachable even though the database and auth are running.

Kong here is not a plain image start: it runs a custom startup script that rewrites its config file by substituting values from your `.env` before Kong boots. If any of those values are missing or malformed, Kong starts, fails to load the config, and never becomes healthy — which is exactly the symptom (`container supabase-kong is unhealthy`, not "exited").

The actual cause is in the container's own log output, which we do not have yet. So step 1 is to read it, then apply the matching fix.

## Step 1 — Read the gateway log (you run this on the server)

```bash
cd /data/webapplication/resl_approval/Quality/backend
docker compose -p resl_quality logs --no-color --tail 120 kong
```

Paste the output back. The last 10-20 lines name the failure.

## Step 2 — Apply the fix that matches the log

Most likely causes, in order:

1. **Missing / empty values in `.env`** — the config references `ANON_KEY`, `SERVICE_ROLE_KEY`, `DASHBOARD_USERNAME`, `DASHBOARD_PASSWORD`, `KONG_HTTP_PORT`, `KONG_HTTPS_PORT`. An empty username/password makes the dashboard auth block invalid and the whole config fails to load.
   Check with: `docker compose -p resl_quality config | grep -A 12 'supabase-kong'` (values must not be blank).
2. **Invalid generated config file** — the substitution script produced YAML Kong rejects (log shows a schema/declarative config error, often naming a line). Fix the offending `.env` value; do not hand-edit the generated file inside the container.
3. **Port already in use** — log shows `bind() ... address already in use` for 8000/8443. Something else on the host holds the mapped port; change `KONG_HTTP_PORT`/`KONG_HTTPS_PORT` in `.env` or stop the conflicting process (`ss -ltnp | grep -E '8000|8443'`).
4. **Stale container from an earlier failed run** — recreate cleanly:
   `docker compose -p resl_quality up -d --force-recreate kong`

## Step 3 — Verify

```bash
docker compose -p resl_quality ps
curl -i http://127.0.0.1:${KONG_HTTP_PORT}/auth/v1/health
```

All containers should read `healthy`/`running`, and the health call should return a response rather than a connection error. Then re-run `docker compose -p resl_quality up -d` so the dependent containers come up.

## Notes

No application code changes are expected here — this is a server configuration issue in the self-hosted backend stack. If the log points at something in `supabase/volumes/api/` that ships with this repo, I will fix that file in the repo as a follow-up.
