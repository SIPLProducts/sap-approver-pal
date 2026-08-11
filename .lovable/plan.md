# Fix the Quality login path: correct env values + plain Node app server

Two separate blockers are visible in your logs. Both are fixed here.

## Blocker 1 — the app server is still a Cloudflare worker

`Qty_App` is looping: `Unable to fetch the Request.cf object`, `TimeoutError`, `Reloading local server...` every 4 seconds. The bundle runs under wrangler/miniflare, which keeps trying to reach Cloudflare from an air-gapped server and never serves a stable port — that is your 502.

Fix: build the Quality bundle as a **plain Node server** instead of a worker.

- `vite.config.ts` gets a `SELF_HOST=1` branch using the Node server preset (Lovable preview/publish stays exactly as-is).
- New `npm run build:selfhost` runs the same two passes and emits `dist/server/index.mjs` as a normal Node HTTP server plus `dist/index.html` + assets for nginx.
- `dist/start.mjs` becomes a small wrapper that loads `dist/.env.runtime` into `process.env` and imports the server. No wrangler, no `.runtime` install, no `--var` bindings, no Cloudflare calls.
- PM2 then runs `node dist/start.mjs` on 8080 and the 4-second reload loop disappears.

## Blocker 2 — wrong values in frontend/.env

### Supabase keys

Your `backend/.env` is the source. In `frontend/.env` use:

```
SUPABASE_URL=http://10.150.150.130:8000
SUPABASE_SERVICE_ROLE_KEY=<the SERVICE_ROLE_KEY value from backend/.env>
SUPABASE_PUBLISHABLE_KEY=<the ANON_KEY value from backend/.env>
VITE_SUPABASE_URL=http://10.150.150.130:8000
VITE_SUPABASE_PUBLISHABLE_KEY=<the ANON_KEY value from backend/.env>
```

The key currently in the service-role slot is the `anon` key — that is what the startup warning reports. It must be the `SERVICE_ROLE_KEY` line (its payload says `"role":"service_role"`), otherwise session creation, profile writes and SAP config reads all fail.

### Shared secret

Your own curl to `127.0.0.1:3002` was rejected with `Invalid or missing x-shared-secret`, so the value the app sends and the value the middleware expects do not match today. Right now they come from two different places: the app reads `sap_global_secrets.proxy_secret` from the database, the middleware reads `MIDDLEWARE_SHARED_SECRET` from its own `.env`.

Fix: one source of truth, the environment.

- All app→middleware calls (SAP login and normal API invoke) send `process.env.MIDDLEWARE_SHARED_SECRET`.
- The app returns a clear configuration error when that value is missing, instead of sending a request with no header.
- The database keeps SAP settings (middleware URL, SAP base URL, SAP user/password) but no longer controls middleware authentication.

So in `frontend/.env`:

```
MIDDLEWARE_URL=http://127.0.0.1:3002
MIDDLEWARE_SHARED_SECRET=<same exact value as middleware/.env>
```

The middleware also needs `APP_BASE_URL=http://127.0.0.1:8080` so its config/log callbacks reach the local app server rather than the cloud host.

## Server steps after the new dist is copied

```bash
pm2 restart Qty_App --update-env
pm2 restart Qty_Appr --update-env
pm2 logs Qty_App --lines 30 --nostream
```

Expected: no wrangler lines, no anon-key warning, and the next middleware log line is the SAP response instead of the shared-secret rejection.

## Verification

Focused tests for the middleware caller: missing secret, matching secret, and a 401 mismatch producing the safe operator message. Secrets are never logged, returned to the browser, or committed.
