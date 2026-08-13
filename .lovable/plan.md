# Fix self-hosted `dist` asset generation

## Goal
Produce one deployable self-host build where the Node server and verification scripts consistently use `dist/client` as the static root.

## Changes
1. **Make the collector enforce the self-host layout**
   - Preserve `dist/client/` during `npm run build:selfhost`.
   - Copy public files into `dist/client/`, never flatten self-host assets into `dist/`.
   - Fail immediately if `dist/client/assets` is missing or if the build unexpectedly leaves only `dist/assets`.

2. **Make verification use the declared static root**
   - Read `staticRoot` from `dist/build-info.json`.
   - Validate assets and HTML references against `dist/client` for `selfhost-node`, and against `dist` for worker builds.
   - Keep the real boot test that requests `/login` and a generated JavaScript asset.

3. **Keep launcher and packaging aligned**
   - Ensure generated `start.mjs` uses `dist/client` for self-host static files.
   - Ensure the package archive includes the complete `client/`, `server/`, launcher, runtime configuration, and deployment helper.
   - Improve output messages so the final listing clearly shows `client/` and refuses a mixed/old layout.

4. **Validate the complete local workflow**
   - Run a clean `npm run build:selfhost`.
   - Confirm `/login` and `/assets/<generated-file>.js` both return HTTP 200 in the boot gate.
   - Run `npm run package:dist` only after verification passes.

## Expected output
```text
dist/
  client/
    assets/
    favicon.png
    manifest.webmanifest
    sw.js
  server/
  start.mjs
  build-info.json
  deploy-frontend.sh
  .env.runtime
```

The self-host build will be rejected before deployment if assets are flattened into `dist/assets` again.
