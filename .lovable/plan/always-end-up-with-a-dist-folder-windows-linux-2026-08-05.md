# Always end up with a `dist/` folder (Windows + Linux)

On your Windows machine `vite build` emitted `.output/` and `.wrangler/` instead of `dist/`, so the post-build collector found nothing to copy. Fix it in two layers so the result is the same everywhere.

## 1. Pin the build output directory

In `vite.config.ts`, set the Nitro/server output directory explicitly to `dist` (alongside the existing Windows-safe MCP wrapper), so the server build stops choosing `.output` on your machine. Client assets already build into `dist/client`.

## 2. Make the collector layout-agnostic

Rewrite `scripts/collect-dist.mjs` so it works no matter which layout the build produced:

- Detect the build output: `dist/client` + `dist/server`, or `.output/public` + `.output/server`.
- If the output landed in `.output/`, move/copy it into `dist/` (`.output/public` → `dist/client`, `.output/server` → `dist/server`, plus `nitro.json`/`package.json`).
- Flatten the static files (`assets/`, `favicon.ico`, `manifest.webmanifest`, `sw.js`, `_headers`, `robots.txt`, `sitemap.xml`) into `dist/` root so the folder looks like your `ramky-vendor-gateway/dist`.
- Fail with a clear message listing what it looked for if neither layout exists, instead of silently doing nothing.
- Keep it pure Node `fs` (no new dependencies), path handling safe for Windows backslashes.

## 3. Housekeeping

- `.gitignore`: also ignore `.output/` and `.wrangler/` (already partly there — verify both entries).
- Update `DEPLOY-QUALITY.md` with one line noting `.output/` is no longer produced and `dist/` is the only artifact to copy to the server.

## Result after `npm run build`

```text
dist/
  assets/
  favicon.ico
  manifest.webmanifest
  sw.js
  _headers
  client/      <- static files the app server serves
  server/      <- app server bundle (run with `npm start`)
  nitro.json  package.json
```

No `.output/` folder. `.wrangler/` may still appear as a local cache directory from wrangler tooling; it is ignored and never shipped.
