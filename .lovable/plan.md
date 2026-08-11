# Fix the self-hosted App Server: run on plain Node, drop wrangler

## What is actually wrong

The app server for the Quality box is currently packaged for the Cloudflare Workers runtime, so `dist` needs `wrangler` + `workerd` installed on the server to boot. That is the root of every error you have hit in a row:

- `wrangler is not installed. Run: npm install --omit=dev --prefix .runtime` — the server can't (or shouldn't have to) install a 120 MB runtime.
- `ERR_MODULE_NOT_FOUND ... dist/start.mjs` — the launcher shim goes missing/stale between copies.
- "Missing Supabase environment variable(s)" — the worker sandbox does not inherit OS/PM2 env, so every value had to be re-injected as `--var` bindings.
- "Asset too large" — the worker asset scan tripping over the installed runtime.

None of these exist if the server bundle is built as a normal Node server. That is the correct fix: the SAP relay, login, session and admin server functions are exactly the same code — only the output target changes.

## The fix

1. **Add a self-host build target.** `vite.config.ts` gets a `SELF_HOST=1` branch that sets `nitro: { preset: "node-server" }` instead of the Cloudflare worker preset. Lovable preview/publish behaviour is untouched (default path stays as-is), so nothing about the hosted version changes.
2. **New script `npm run build:selfhost`** — same two-pass build (static shell + app), but the app pass runs with `SELF_HOST=1`. Output: `dist/index.html` + `dist/assets` for nginx, and `dist/server/index.mjs` as a self-contained Node server.
3. **Simplify the launcher.** `dist/start.mjs` becomes a tiny wrapper that just imports `./server/index.mjs` with `PORT`/`HOST` applied — no wrangler lookup, no `--var` binding list, no `.runtime` install, no `dist/node_modules` cleanup. `scripts/collect-dist.mjs` stops emitting the `.runtime` package and the `--var` plumbing.
4. **Keep the env safety net.** The launcher still loads `dist/.env.runtime` (generated from `frontend/.env` at build time) into `process.env`, still refuses to start when `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are blank, and still warns when the service-role slot holds an `anon` key — your last log line shows it currently does, so that must be corrected in `frontend/.env` with the real value from `supabase/.env`.
5. **Update the deployment handbook + PM2 config** to `node dist/start.mjs` (or `dist/server/index.mjs`) on port 8080, with nginx keeping the existing `/_serverFn/` and `/api/` proxy blocks.

## Result on the server

```bash
cd /data/webapplication/resl_approval/Quality/frontend/dist
pm2 restart Qty_App --update-env
pm2 logs Qty_App --lines 30 --nostream
```

No npm install on the server, no workerd, no wrangler, nothing to download — plain `node`. Once the service-role key in `frontend/.env` is the real one, login goes browser → app server → middleware → SAP.

## Technical notes

- `node-server` preset is supported by the installed nitro (3.0.260603-beta) and by the Lovable vite config's `nitro: { preset }` option.
- Node server inherits `process.env` directly, which is why the whole `--var` binding layer disappears.
- `MIDDLEWARE_URL` and `MIDDLEWARE_SHARED_SECRET` are still read server-side inside handlers; the shared secret must match `middleware/.env` and the `sap_global_secrets` row.
