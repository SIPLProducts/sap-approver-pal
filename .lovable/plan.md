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
```

If `SUPABASE_SECRET_KEY` is also merely a duplicate of `SERVICE_ROLE_KEY`, clear
`SUPABASE_SECRET_KEY=` as well. Do not print any keys.

Recreate only the gateway and verify port 8000:

```bash
docker compose -p resl_quality up -d --force-recreate kong
docker compose -p resl_quality ps kong
docker compose -p resl_quality logs --tail 30 kong
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/auth/v1/health
```

Expected: Kong is healthy and the last command is not `000`.

## Step 2 — create a genuinely clean frontend build

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

## Step 3 — replace the whole server dist atomically

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

## Step 4 — verify before opening the browser

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
