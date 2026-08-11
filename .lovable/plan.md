# Stabilise the Quality app server on port 8080

Your logs show three distinct things. Only two are real failures.

## What the logs actually say

1. **Fatal — asset too large.** `npm install` inside `dist/` created `dist/node_modules`, which contains the 122 MiB `workerd` binary. The whole `dist/` folder is the served asset directory, so startup aborts. This is the reason nothing ever holds port 8080 for long.
2. **Fatal — missing backend env.** `Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` — `dist/.env.runtime` is absent or was not read. This is the same red banner you saw on the login page.
3. **Not fatal — `Request.cf` timeout.** The offline box cannot reach Cloudflare's metadata endpoint, so it warns and falls back to a placeholder. Combined with the file watcher seeing `dist/node_modules` change, it turns into the visible reload churn. Fixing (1) removes the churn.

There is also an older `ENOENT .../dist/server/index.mjs` line, meaning at that moment the deployed folder was incomplete. The new build must always contain `dist/server/index.mjs`.

## Code change: keep runtime dependencies out of the asset folder

Edit `scripts/collect-dist.mjs` so the self-contained runtime lives in `dist/.runtime/` instead of `dist/`:

- Write `dist/.runtime/package.json` with the `wrangler` dependency (instead of `dist/package.json`).
- `dist/start.mjs` spawns wrangler from `dist/.runtime/node_modules/.bin/wrangler`, adds `--no-live-reload`, and keeps loading `dist/.env.runtime` as it does today.
- Extend the generated `.assetsignore` with `/node_modules`, `/.runtime`, and `/.env.runtime` so nothing large is ever treated as a served asset.
- Keep the existing offline defaults (`CI=true`, `WRANGLER_SEND_METRICS=false`) and add `NO_COLOR=1` for readable PM2 logs.

No application, middleware, Nginx, or database logic changes.

## What you do on the server

```bash
pm2 stop Qty_App

cd /data/webapplication/resl_approval/Quality/frontend
# remove the bad install that broke startup
rm -rf dist/node_modules dist/package-lock.json
```

Then deploy the freshly built `dist/` from VS Code (`npm run build`), and:

```bash
cd dist
ls server/index.mjs            # must exist
npm install --omit=dev --prefix .runtime
```

Create `dist/.env.runtime` (this is the fix for problem 2):

```ini
PORT=8080
HOST=127.0.0.1
NODE_ENV=production
SUPABASE_URL=http://127.0.0.1:8000
SUPABASE_PUBLISHABLE_KEY=<Quality ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<Quality SERVICE_ROLE_KEY>
MIDDLEWARE_SHARED_SECRET=<exact same secret as middleware/.env>
```

```bash
chmod 600 .env.runtime
pm2 restart Qty_App --update-env
pm2 logs Qty_App --lines 40 --nostream
```

## Verify

```bash
ss -ltnp | grep ':8080'                 # must show the node/workerd process
curl -i http://127.0.0.1:8080/          # 200
curl -i -X POST http://127.0.0.1:8080/api/public/middleware/config \
  -H 'content-type: application/json' -d '{"name":"Login_API"}'
```

Expected: no "Asset too large", no "Missing Supabase environment variable(s)", and the config call answers 401 about the shared secret (proving the route ran). A `Request.cf` warning may still appear once at startup — it is harmless.

Then log in at `http://10.150.150.130:8081/login`.
