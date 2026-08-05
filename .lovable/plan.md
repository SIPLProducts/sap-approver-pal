# Emit `dist/index.html` so nginx can use `root .../frontend/dist`

Goal: after `npm run build`, `dist/` contains `index.html` + `assets/` + static files, so your nginx block works as written:

```text
root /data/webapplication/resl_approval/Quality/frontend/dist;
index index.html;
```

Nothing about SAP, login, email, push, admin or MCP changes. All server functions stay exactly where they are.

## Why login/SAP keep working

`index.html` only decides how the **first paint** is delivered. The SAP and login calls are separate HTTP requests the browser makes afterwards (`/_serverFn/*`, `/api/*`). nginx serves `index.html` from `dist/` and proxies those request paths to the running app server (`npm start`, port 3001 by default). Same code, same endpoints — only the shell HTML moves from "rendered per request" to "a file on disk".

## Changes

### 1. Turn on the static shell in `vite.config.ts`
Enable TanStack Start's SPA shell so the build prerenders one static shell page:

```text
tanstackStart: {
  server: { entry: "server" },
  spa: { enabled: true, prerender: { enabled: true, outputPath: "/index.html" } },
}
```

This adds `dist/index.html`. The `dist/server` bundle is still produced and still required for SAP/login/admin calls.

### 2. `scripts/collect-dist.mjs`
Verify `index.html` landed at the `dist/` root after the existing flatten step, and fail the build with a clear message if it did not. Keep the current behaviour otherwise (flatten statics, keep `server/`, drop `.output/`, `.wrangler/`, `dist/client/`).

### 3. Root route
The root route must render a shell that is safe without per-request data. Check `src/routes/__root.tsx` and `src/routes/index.tsx` for anything read during SSR of the shell; move such reads into the client (existing loaders on `_authenticated` routes are unaffected because they run client-side under SPA mode).

### 4. nginx snippet for the docs
Add to `DEPLOY-QUALITY.md`: the static root plus the two proxy locations that keep SAP and login working.

```text
root /data/webapplication/resl_approval/Quality/frontend/dist;
index index.html;

location / { try_files $uri /index.html; }

location /_serverFn/ { proxy_pass http://127.0.0.1:3001; }
location /api/       { proxy_pass http://127.0.0.1:3001; }
```

## Verification

- `npm run build` → `dist/index.html`, `dist/assets/`, `dist/server/`, favicon/sitemap/manifest/sw.js at the root.
- `npm start` still serves the app; login and one SAP screen (PR Release) load data.
- Deep-link refresh on `/mm/pr-release` returns the app, not a 404.

## Note

If the app server is not running, the page shell will still load but SAP screens and login will have nothing to call. `npm start` (or the service unit) must stay up — that is unchanged from today.
