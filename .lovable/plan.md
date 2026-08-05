# Produce a `dist/` folder from the build (server kept)

Goal: after `npm run build`, get a top-level `dist/` folder that looks like your `ramky-vendor-gateway/dist` (index.html, `assets/`, favicon, manifest, robots, sitemap, sw.js), while the app still runs as a Node process behind nginx — because this app has 26 server-function modules (SAP login, PR/PO/ZNFA release, MIGO, user management, email, push) that need a running server.

## What will be added

1. **`scripts/collect-dist.mjs`** — a small Node script that runs after the build:
   - locates the build output directory (`.output/` produced by the TanStack Start / Cloudflare build; falls back to `dist/` if the toolchain already emits it),
   - clears and recreates top-level `dist/`,
   - copies the static client assets (`assets/`, `index.html` if present, favicon, `manifest.webmanifest`, `robots.txt`, `sitemap.xml`, `sw.js`, and everything else from the output's public folder) into `dist/`,
   - copies the server bundle into `dist/server/` so one folder can be shipped to the Quality server,
   - prints a short summary of what it copied.

2. **`package.json` scripts**
   - `build` → `vite build && node scripts/collect-dist.mjs`
   - `build:dev` → same with `--mode development`
   - add `start` → runs the built server entry from `dist/server` with Node on `PORT` (default 8081-facing port of your choice).

3. **`.gitignore`** — add `dist/` so the generated folder isn't committed.

4. **`DEPLOY-QUALITY.md`** (short, single file) — the exact steps for `10.150.150.130`:
   - `npm ci && npm run build` on a build machine, copy `dist/` to `/data/webapplication/resl_approval/Quality/frontend`,
   - run the app server with pm2/systemd on a local port (e.g. 127.0.0.1:8080),
   - nginx on 8081: `/` → app server, `/mw/` → middleware 3002, `/supabase/` → Kong 8000, `/studio/` → Studio 3000, with static `dist/assets` served directly by nginx for caching.

## Important note

`dist/` here is a convenience bundle, not a standalone static site. Opening `dist/index.html` from nginx alone will render the shell but SAP calls, login, and admin screens will fail unless the Node server process from `dist/server` is running and nginx proxies to it. That matches your chosen setup ("Node process behind nginx").

## Technical details

- No changes to `vite.config.ts` (the Windows-safe MCP wrapper stays as-is).
- The collect script is pure Node `fs` (no new dependencies), works on Windows and Linux.
- Output layout:

```text
dist/
  index.html
  assets/...
  favicon.ico
  manifest.webmanifest
  robots.txt
  sitemap.xml
  sw.js
  server/        <- Node server bundle (run with `node dist/server/index.mjs`)
```
