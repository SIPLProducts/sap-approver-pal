# Permanent fix for Quality frontend and gateway startup

## Confirmed causes

1. **Port 8080:** `src/server.ts` exports a Worker-style `fetch(request, env,
   ctx)` handler. The generated `start.mjs` only imports `server/index.mjs` and
   assumes that import opens a Node listener. The log therefore says “serving”
   before any socket exists, and the process can return without binding 8080.
2. **Missing browser assets:** the deployed `index.html` and `assets/` came
   from different build passes/releases. The current deployment helper checks
   only that files exist, not that every hashed asset referenced by HTML exists.
3. **Gateway:** `kong.yml` always declares legacy and modern key credentials.
   Its entrypoint removes empty rows but not duplicate rows, so any inherited or
   stale modern key equal to the legacy anon/service key makes Kong crash.

## Implementation

### 1. Make the self-hosted server actually listen

- Add a Node-only HTTP adapter used exclusively by `npm run build:selfhost`.
- Convert incoming Node requests to Web `Request`, call the existing
  `src/server.ts` fetch handler, and stream the Web `Response` back to Node.
- Bind `HOST`/`PORT` explicitly and log “listening” only from the successful
  listen callback.
- Preserve the existing Worker entry for Lovable preview/publish; self-hosting
  must not change the cloud runtime.
- Make `start.mjs` treat an imported bundle that returns without a listener as
  a startup error, so PM2 cannot report a false success again.

### 2. Produce one internally consistent deployment artifact

- Keep the two-pass build only where the static shell is required, but record a
  build fingerprint shared by `index.html`, `assets/`, and `server/`.
- Validate every local `/assets/...` reference in the final HTML after
  collection; fail `npm run build:selfhost` if any referenced file is absent.
- Emit `build-info.json` with build mode and fingerprint.
- Ensure the final self-host artifact is assembled from one clean build output,
  with stale `dist`, `.output`, and `.wrangler` removed first.

### 3. Make deployment fail fast instead of waiting indefinitely

- Require `build-info.json` and validate hashed HTML assets before restarting
  PM2.
- Replace the repeated noisy curl loop with bounded silent polling.
- If the process exits or 8080 does not bind, stop immediately and print PM2’s
  exit code and error log.
- Verify `/`, the middleware config route, SAP middleware health, and gateway
  health only after the listener is confirmed.
- Require atomic deployment with `rsync -a --delete`; never merge into an old
  `dist`.

### 4. Make Kong tolerate legacy-only configuration safely

- In `kong-entrypoint.sh`, render the config and remove modern publishable or
  secret credential rows when they are empty **or equal** to the corresponding
  legacy anon/service credential.
- Validate the rendered declarative config before starting Kong and print only
  credential names/status—never values.
- Update Quality environment examples to leave asymmetric and modern opaque
  key variables empty unless that mode is intentionally configured.

### 5. Update the Quality runbook

Document one supported flow:

```bash
# Build machine
npm ci
npm run build:selfhost
rsync -a --delete dist/ root@10.150.150.130:/data/webapplication/resl_approval/Quality/frontend/dist/

# Quality server
cd /data/webapplication/resl_approval/Quality/backend
docker compose --env-file .env -p resl_quality up -d --force-recreate kong

cd /data/webapplication/resl_approval/Quality/frontend/dist
bash deploy-frontend.sh
```

Expected checks: gateway healthy, Node listening on 127.0.0.1:8080, no missing
hashed assets, middleware health 200, and the login route loads through 8081.

## Security follow-up

All credentials pasted into chat must be rotated after recovery: database,
JWT/signing, anon/service role, dashboard, storage, and related application
runtime values. Replacement values must not be pasted into chat or committed.

No SAP business logic, UI behavior, or database schema changes are included.