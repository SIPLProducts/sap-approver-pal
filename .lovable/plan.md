# Prevent incomplete self-host deployments

## Goal
Produce and deploy one complete self-host archive where both browser assets and every server-side module are present before PM2 is restarted.

## Confirmed diagnosis
- Self-host browser files live under `dist/client`, but `deploy-frontend.sh` currently checks `/login` references against the `dist` root. This creates the reported false asset failure.
- The deployed SSR router imports `server/_authenticated-pFGYXFRT.mjs`, but that file is absent, so the deployed `server/` folder is incomplete or mixed.
- The local runtime gate treats the client fallback as a successful `/login` response. That masks the missing SSR chunk and allows an invalid archive to be packaged.

## Changes
1. **Validate the complete server module graph**
   - Scan all emitted server JavaScript for relative static and dynamic imports.
   - Resolve each referenced `.mjs`/`.js` chunk and fail verification if any target is absent.
   - Report the importing file and missing target clearly.

2. **Require real SSR in the local boot gate**
   - Treat the `x-ssr-fallback: client-boot` response as a build failure during `npm run build:selfhost` and packaging.
   - Keep requesting `/login` and one generated browser asset, but only pass when `/login` renders without the fallback.

3. **Verify the archive, not only the source folder**
   - After creating `quality-frontend-dist.tar.gz`, inspect its contents and confirm every required server chunk and `client/assets` file is included.
   - Refuse to publish a partial archive.

4. **Correct the server deployment checks**
   - Read `staticRoot` from `build-info.json` and check `/login` asset references under `client/` for `selfhost-node`.
   - Run the server-import integrity check before restarting PM2, so an incomplete extraction is rejected without taking down the working version.
   - Improve the failure text to distinguish a missing browser asset from a missing SSR module.

5. **Validate the full workflow**
   - Run a clean self-host build and confirm no missing server imports.
   - Confirm `/login` uses real SSR and `/assets/<generated-file>.js` returns HTTP 200.
   - Package the build and verify the archive contains the same complete `client/` and `server/` trees.

## Deployment outcome
The server will accept only a freshly extracted whole archive. If a server chunk is omitted or old files are mixed with new files, deployment stops before PM2 restart and names the exact missing file.
