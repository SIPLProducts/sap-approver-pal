# Fix the local self-host build failing its own deploy check

## About the earlier fix

The only app change made for the "Array must contain at most 50/200 elements" issue
was raising the plant/role limits in `src/lib/admin/user-mgmt.functions.ts`. No build,
packaging or deployment file was touched, so it is not the cause of this build failure.

## What is happening

`npm run build:selfhost` builds fine, but the final gate fails:

```text
FAIL /assets/activity-C9qlZmC7.js returned HTTP 500
ENOENT ... dist\client\assets\activity-C9qlZmC7.js
```

The app server bundle (Node preset) serves static files from `dist/client`, because that is the public directory it was built with. The post-build collector flattens those files up into `dist/` (`dist/assets/`, `favicon.png`, ...) and then deletes `dist/client`. So the server is left pointing at a folder that no longer exists, and every `/assets/*.js` request becomes a 500. Nothing is wrong with your machine or the code you wrote — it is the packaging step.

## The fix

Make the self-host layout match what the app server expects, instead of flattening it away.

1. **`scripts/collect-dist.mjs`** — when building self-host (`SELF_HOST=1`):
   - keep `dist/client/` as the static root (do not flatten into `dist/` and do not delete it),
   - still merge missing `public/` files (`robots.txt`, `sitemap.xml`, ...) into `dist/client/`,
   - build the fingerprint (`build-info.json`) and the SSR fallback shell from `dist/client/assets` instead of `dist/assets`,
   - keep the `.assetsignore`, `.env.runtime`, `start.mjs`, `ecosystem.config.cjs` and `deploy-frontend.sh` generation exactly as today,
   - print the corrected summary: statics live in `dist/client`, nginx `root .../dist/client` for direct asset serving, `/` proxied to the app server on 8080.

   The worker (Lovable preview/publish) path keeps its current flattened behaviour unchanged.

2. **`scripts/verify-dist.mjs`** — resolve the assets folder as `dist/client/assets` when `build-info.json` says `selfhost-node`, else `dist/assets`. The dangling-reference scan and the live boot test then check the same folder the server actually serves, so a real breakage still fails the gate.

3. **`build-info.json`** — record the static root (`client` vs `.`) so the deploy helper and verifier agree without guessing.

4. **`DEPLOY-QUALITY.md`** — one short section update: for self-host, statics are at `dist/client`, nginx `location /assets/` may serve them directly, `location /` proxies to `127.0.0.1:8080`.

## After the change

```text
dist/
  client/          <- assets/, favicon.png, manifest.webmanifest, sw.js
  server/          <- app server bundle (+ ssr-fallback.html)
  start.mjs  .env.runtime  ecosystem.config.cjs  deploy-frontend.sh  build-info.json
```

`npm run build:selfhost` ends with `[verify-dist] PASS`, including the boot test that fetches a real hashed chunk over HTTP — the exact check that fails today.
