# One recovery sequence — do not rerun the stale dist

You have two confirmed faults. Follow these steps in order.

## Step 1 — repair the backend gateway

The gateway log proves `ANON_KEY` and `SUPABASE_PUBLISHABLE_KEY` contain the
same legacy anon JWT. The gateway registers both and refuses the duplicate.

On the server, open:

```bash
cd /data/webapplication/resl_approval/Quality/backend
nano .env
```

Keep `ANON_KEY` unchanged. Find `SUPABASE_PUBLISHABLE_KEY` and clear only that
duplicate value:

```ini
SUPABASE_PUBLISHABLE_KEY=
ANON_KEY_ASYMMETRIC=
```

The pasted environment confirms both values currently duplicate `ANON_KEY`.
Keep `SUPABASE_SECRET_KEY=`, `SERVICE_ROLE_KEY_ASYMMETRIC=`, `JWT_KEYS=`, and
`JWT_JWKS=` empty for this legacy HS256 setup. Do not print the file or its keys
again.

Recreate only the gateway, wait for its health probe, then test port 8000:

```bash
docker compose -p resl_quality up -d --force-recreate kong
for i in $(seq 1 30); do
  STATUS=$(docker inspect -f '{{.State.Health.Status}}' supabase-kong 2>/dev/null)
  echo "kong: $STATUS"
  [ "$STATUS" = healthy ] && break
  sleep 2
done
docker compose -p resl_quality ps kong
docker compose -p resl_quality logs --tail 50 kong
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/auth/v1/health
```

Your shown `000` occurred while the container still said `health: starting`; it
does not yet prove another Kong failure. Expected after waiting: `healthy` and
an HTTP result other than `000`. If it becomes `unhealthy`, stop and use the
last 50 log lines to diagnose that separately.

## Step 2 — capture the frontend crash before rebuilding

Do not rerun the deploy helper yet. It restarted PM2 successfully, but nothing
answered on port 8080. Capture the actual process failure:

```bash
pm2 status Qty_App
pm2 logs Qty_App --err --lines 100 --nostream
pm2 describe Qty_App
node start.mjs
```

`node start.mjs` is intentionally run in the foreground. Copy the first complete
error and stack trace; press Ctrl-C only if it remains running. The next code
fix must be based on that error, not another blind restart.

The current verification confirms port 8080 is not listening. It also confirms
the browser HTML references ten JavaScript files absent from this `dist`; that
folder must not be reused even if the PM2 startup error is repaired.

## Step 3 — create a genuinely clean frontend build

Do this on the machine containing the frontend source — **not** inside the
server's existing `dist/`:

```bash
cd <frontend-source-folder>
npm ci
rm -rf dist .output .wrangler
npm run build:selfhost
```

Do not run `bash deploy-frontend.sh` against the old folder again; it validates
startup files but cannot manufacture the missing hashed JavaScript files.

## Step 4 — replace the whole server dist atomically

From the build machine:

```bash
rsync -a --delete dist/ root@10.150.150.130:/data/webapplication/resl_approval/Quality/frontend/dist/
```

If rsync is unavailable, rename/delete the old server `dist` first and copy the
entire newly-built folder. Never merge one `dist` over another.

Then on the server:

```bash
cd /data/webapplication/resl_approval/Quality/frontend/dist
bash deploy-frontend.sh
pm2 save
```

## Step 5 — verify before opening the browser

```bash
ss -ltnp | grep ':8080'
curl -s --compressed http://127.0.0.1:8081/login \
  | grep -ao 'assets/[^"]*\.js' | sort -u \
  | while read f; do [ -f "$f" ] && echo "OK   $f" || echo "MISS $f"; done
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/auth/v1/health
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3002/__health
```

Required result: port 8080 is listening, every asset says `OK`, and neither
health request says `000`. Keep nginx unchanged. Hard-refresh with Ctrl-Shift-R.

## Permanent repository fixes

1. Update the gateway entrypoint to omit publishable/secret credential entries
   when they duplicate the legacy anon/service keys, preventing this startup
   failure even with legacy-only configuration.
2. Make the build fail unless every asset named by the server manifest exists
   in the same `dist/assets/`.
3. Add a build fingerprint to `dist/build-info.json`; make the deploy script
   reject mixed or partial folders before restarting PM2.
4. For self-host builds, stop copying the first-pass static shell into the final
   dist; HTML is rendered by the Node server.
5. Document atomic `rsync --delete` deployment and both health checks.

Nothing changes SAP middleware behavior or the database schema.

## Required credential rotation

The environment file was pasted into chat and includes live database, JWT,
service-role, dashboard, storage, and signing credentials. Treat every pasted
secret as exposed. After service recovery, generate replacement values, update
the backend and frontend runtime environment consistently, recreate affected
containers, restart the app, and invalidate old credentials. Do not paste the
new values into chat or command output.
