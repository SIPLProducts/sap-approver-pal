# Fix the self-host bundle contract and stale shell failure

## Confirmed diagnosis

- The immediate port 8080 failure is **not caused by a missing `index.html`**. `start.mjs` exits because it assumes `server/index.mjs` must export `default.fetch`; the deployed generated server is a standalone Node-server shape that starts its own listener instead.
- The current verifier checks that files exist, but it does not prove that `start.mjs` can actually start the generated server. That is why this incompatible archive passed verification.
- The reported `TypeError: jsxDevRuntimeExports.jsxDEV is not a function` is a second, independent failure inside the generated SSR bundle. The local generated bundle is not currently present to identify its exact injection point, so the fix will inspect the fresh production output and remove the development/production React runtime mismatch before packaging.
- A self-host build intentionally has no root `index.html`: pages are rendered by the app server. Adding one would recreate the stale-hash problem.
- The first screenshot shows an older HTML shell requesting obsolete hashes such as `index-BefOrEbA.js`, while the current generated assets use different hashes. Nginx or browser/service-worker cache is therefore still serving the old shell independently of the port 8080 startup failure.

## Implementation

1. **Make the launcher understand both valid server outputs**
   - Load runtime environment before importing the generated server.
   - If the module exports a Fetch-compatible handler, keep using the existing Node HTTP adapter.
   - If it is a standalone Node-server entry, let that entry own the listener instead of exiting with “does not export a fetch handler.”
   - Correct the generated `NITRO_HOST` value so it receives the configured host, not the port.

2. **Fix and gate the React SSR runtime**
   - Force the self-host app pass and its launcher to use a consistent production React runtime from build start, rather than relying on an environment value applied after modules begin loading.
   - Inspect the fresh `dist/server` output for `jsxDEV` / development JSX-runtime references and trace any remaining reference back to the build configuration or dependency that emitted it.
   - Keep React and React DOM resolved as one matching pair in the server bundle; do not patch generated JavaScript by hand.
   - Make `/login` rendering part of the build gate so a `jsxDEV is not a function` crash can never reach the deployment archive.

3. **Preserve assets required by a standalone server**
   - Keep the generated client asset directory where the Node-server bundle expects it, while retaining the root asset copy used by Nginx/static handling.
   - Continue forbidding a root `index.html` for `selfhost-node` builds.

4. **Turn verification into a real runtime gate**
   - Extend self-host verification to launch `dist/start.mjs` on a temporary local port, wait for it to listen, request `/login` and a known hashed asset, then stop it.
   - Fail `npm run build:selfhost` and `npm run package:dist` if the process exits, does not bind, returns a server error, or cannot serve its assets.
   - Record the detected server shape in `build-info.json` and have the deployment helper print/check it.

5. **Eliminate the stale Nginx/browser shell path**
   - Keep `location /` proxied to the app server and serve only versioned `/assets/` from the same extracted archive.
   - Update deployment checks to fail if `/login` from port 8081 has static-file headers or references any missing hashed asset.
   - Provide one clean replacement procedure: extract the verified archive into an empty `dist/`, reload the supplied Nginx config, restart the app, and clear/unregister the old service worker once.

## Success checks

- `npm run build:selfhost` proves the generated `start.mjs` listens and `/login` responds before completing.
- The production server bundle no longer throws `jsxDevRuntimeExports.jsxDEV is not a function`; the verifier confirms `/login` returns usable HTML and every referenced hashed asset exists.
- `npm run package:dist` cannot package a server/launcher mismatch.
- On the Quality server, `bash deploy-frontend.sh` reports port 8080 healthy and `/login` plus all referenced assets available through 8081.
- No root `dist/index.html` is required or generated.
