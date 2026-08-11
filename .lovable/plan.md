# Fix the 502: get the app server listening on 8080

Nginx returns 502 because nothing is listening on `127.0.0.1:8080`. Nginx serves the
static files fine, but every login call goes to `/_serverFn/*` and `/api/*`, which
nginx proxies to 8080 — with no process there, that is an instant 502.

## What must run on 8080 and why

Login is not a browser-to-SAP call. The chain is:

```text
browser (8081)  ->  nginx  ->  app server on 127.0.0.1:8080   (server functions)
                                     |
                                     +-> SAP middleware 127.0.0.1:3002 -> SAP
                                     +-> Supabase (Kong) 127.0.0.1:8000
```

The app server holds the service-role key and the middleware shared secret, creates
the session, and relays SAP calls. Static files alone cannot log anyone in.

## Steps on the server (nothing here touches the middleware on 3002)

1. Build on a machine with Node 20+: `npm ci && npm run build:selfhost`
   (`build:selfhost` is required — it emits `dist/server/index.mjs` as a plain Node
   HTTP server instead of a Cloudflare worker bundle).
2. Copy the whole `dist/` folder to
   `/data/webapplication/resl_approval/Quality/frontend/dist/`.
3. Confirm `frontend/.env` has `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` (the real service key from `backend/.env`, not the
   anon key), `MIDDLEWARE_URL=http://127.0.0.1:3002`, `MIDDLEWARE_SHARED_SECRET`.
4. From inside `dist/`: `bash deploy-frontend.sh` — it regenerates `.env.runtime`,
   validates the keys, starts/restarts pm2 `Qty_App` on 8080 and runs health checks.
5. Reboot persistence: `pm2 save && pm2 startup`.

## Verify in this order

```bash
ss -lntp | grep ':8080'                       # a node process must appear
curl -I http://127.0.0.1:8080/                # 200
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  http://127.0.0.1:8080/api/public/middleware/config   # 401 = alive, env visible
curl -I http://10.150.150.130:8081/           # 200 through nginx
curl -s http://127.0.0.1:3002/__health        # middleware OK
```

If 8080 answers directly but nginx still 502s, nginx is missing the two proxy
blocks (`/_serverFn/` and `/api/`) to `127.0.0.1:8080` — both are in
`DEPLOY-QUALITY.md` section 3.

## Diagnostics if pm2 will not stay up

`pm2 logs Qty_App --lines 50`. Expected causes and their meaning:

- `server/index.mjs is missing` — the copied `dist/` came from `npm run build`, not
  `build:selfhost`. Rebuild.
- `Missing Supabase environment variable(s)` — `frontend/.env` keys empty; fix and
  re-run the script.
- `warning: ... holds a 'anon' key` — service-role slot has the anon key; sessions
  cannot be created.
- `Asset too large` / wrangler errors — a stale `dist/` with `node_modules` or
  `.runtime`; delete both and redeploy a fresh build.

## Repo work in this plan

Documentation only, unless the log output points at a code fault:
`DEPLOY-QUALITY.md` gains a short "502 on /_serverFn — nothing on 8080"
troubleshooting section mirroring the checks above, so this is self-serve next time.
No application code changes are needed to fix the 502 itself.
