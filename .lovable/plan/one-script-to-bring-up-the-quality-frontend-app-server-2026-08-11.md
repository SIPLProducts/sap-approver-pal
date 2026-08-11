# One script to bring up the Quality frontend / app server

Instead of typing the recovery steps, you get a single script you run on the server after copying the new `dist/` in.

## What ships

1. **`scripts/collect-dist.mjs` change** — the runtime stops polluting the asset folder:
   - `wrangler` is installed into `dist/.runtime/` (not `dist/node_modules/`), so the 122 MiB `workerd` binary is never treated as a served asset — this is what kills startup today;
   - `dist/start.mjs` runs wrangler from `.runtime`, adds `--no-live-reload`, keeps loading `dist/.env.runtime`, keeps offline mode (`CI=true`, `WRANGLER_SEND_METRICS=false`);
   - `.assetsignore` also lists `/node_modules`, `/.runtime`, `/.env.runtime`.

2. **New `scripts/deploy-frontend.sh`**, also copied into `dist/` by the build so it is right next to what it manages. You run this one command on the server:

```bash
cd /data/webapplication/resl_approval/Quality/frontend/dist
bash deploy-frontend.sh
```

It performs, in order, and stops with a clear message on the first failure:

- sanity-check the folder: `index.html`, `server/index.mjs`, `start.mjs` must exist;
- delete a stale `dist/node_modules` and `package-lock.json` left from the earlier bad install;
- create `.env.runtime` from a template if missing, then refuse to continue until you fill in the two keys (it tells you which are blank);
- verify `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MIDDLEWARE_SHARED_SECRET` are non-empty and `chmod 600` the file;
- `npm install --omit=dev --prefix .runtime` (only if `.runtime/node_modules` is missing or `--reinstall` is passed);
- `node --check start.mjs`;
- `pm2 restart Qty_App --update-env` (or `pm2 start start.mjs --name Qty_App` if the process does not exist), then `pm2 save`;
- wait for port 8080 to answer, then run the three checks: `/`, `/api/public/middleware/config` (401 about the shared secret is the success signal), and the middleware `__health` on 3002;
- print a short PASS/FAIL summary and the last 20 lines of `pm2 logs Qty_App` when anything fails.

It never touches `Qty_Approval`, Nginx, Docker, or the database.

Options: `--reinstall` (force the `.runtime` install), `--no-restart` (checks only), `--port 8080`.

## Values you must put in `.env.runtime`

```ini
PORT=8080
HOST=127.0.0.1
NODE_ENV=production
SUPABASE_URL=http://127.0.0.1:8000
SUPABASE_PUBLISHABLE_KEY=<Quality ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<Quality SERVICE_ROLE_KEY>
MIDDLEWARE_SHARED_SECRET=<exact same secret as middleware/.env>
```

Both keys come from the self-hosted `supabase/.env` on that box. Without them login fails with the red "Missing Supabase environment variable(s)" banner, which is exactly what your logs show.

## Your flow from now on

```bash
# VS Code
npm run build

# copy dist/ to the server, then
cd /data/webapplication/resl_approval/Quality/frontend/dist
bash deploy-frontend.sh
```
