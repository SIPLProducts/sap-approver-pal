# Make local `npm run build` produce a ready-to-run `dist/`

Goal: after the first-time server setup, deploying = copy `dist/` + `pm2 restart`. No script to run, no `.env` to edit on the server.

## What can move into the local build

- Runtime env file: the build reads your local `frontend/.env` and writes `dist/.env.runtime` (server keys: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MIDDLEWARE_URL`, `MIDDLEWARE_SHARED_SECRET`, plus `PORT=8080`, `HOST=0.0.0.0`, `NODE_ENV=production`), always with LF endings. So you never create or edit env files on the server again.
- pm2 config: the build emits `dist/ecosystem.config.cjs` (name `Qty_App`, script `start.mjs`, cwd `dist`, offline-safe env). One command starts it.
- Safety cleanup that the helper script used to do (removing an illegal `dist/node_modules`) moves into the launcher `start.mjs`, so it self-heals on start.
- `deploy-frontend.sh` stays in `dist/` but becomes optional — only a health-check helper, not a required step.

## What cannot move into the local build (one-time only)

`dist/.runtime/` holds `wrangler`/`workerd`, which is a native Linux binary. A Windows/VS Code build cannot produce the Linux binary, so it must be installed on the server **once**:

```bash
cd /data/webapplication/resl_approval/Quality/frontend/dist
npm install --omit=dev --prefix .runtime
pm2 start ecosystem.config.cjs && pm2 save
```

After that, every future deploy is:

```bash
# copy the new dist/ over the old one, keeping dist/.runtime
pm2 restart Qty_App --update-env
```

`.runtime/` lives outside the served asset folder, so it never triggers the Cloudflare "Asset too large" error.

## Why the port-8080 process exists at all

The UI is static, but login and every SAP call run as server functions that hold the service-role key and the middleware shared secret — those cannot be shipped in browser code. Flow stays: Browser -> Nginx :8081 -> App server :8080 -> Middleware :3002 -> SAP.

## Technical changes

- `scripts/collect-dist.mjs`: read root `.env` at build time, emit `dist/.env.runtime` (LF, only server-relevant keys, skip `VITE_*`); emit `dist/ecosystem.config.cjs`; keep `.runtime` package.json emit; add both to `.assetsignore`.
- `dist/start.mjs`: delete a stray `dist/node_modules` before boot; keep offline flags (`CI=true`, `WRANGLER_SEND_METRICS=false`, `--no-live-reload`); fail with a one-line hint if `.runtime` is missing.
- `scripts/deploy-frontend.sh`: reduced to verification/health checks (port 8080, `/_serverFn`, middleware) — no longer required for deploys.

## Verify

Local: `npm run build`, then confirm `dist/.env.runtime`, `dist/ecosystem.config.cjs`, `dist/start.mjs` exist and `node --check dist/start.mjs` passes.
