# Get the Quality login page back up

## Confirmed diagnosis

The folder currently running is still an **older mixed build**, even though it
contains a deploy script. The proof is the deploy output:

```text
OK index.html
OK server/index.mjs
OK start.mjs
```

A current deploy script checks `server/index.mjs`, `start.mjs` and
`build-info.json`; it does **not** require `index.html`. Its output also checks
`/login` and all referenced assets. Therefore the server is executing an old
`deploy-frontend.sh`, and a PASS from that script does not prove that the login
assets match.

The latest build log independently confirms the mismatch: `index.html` refers
to multiple hashed JavaScript files that are absent from `assets/`, and the build
correctly stopped with `Do not deploy it`. Deploying that output would keep the
login page blank.

The latest server commands now confirm the same thing for the folder called
"new build": both `build-info.json` and `deploy-frontend.sh` are absent. Those
files are emitted only after `npm run build:selfhost` completes successfully.
Therefore this folder came from a failed build, an ordinary Vite build, or an
incomplete copy; it is not deployable regardless of its folder date/name.

The screenshot also shows three candidate folders (`dist`, `dist 11-08-2026`,
and `dist_11082026`). Renaming or selecting an old folder does not repair the
server/assets pairing. Only one newly produced, validated folder should remain.

### Two separate faults, both proven by the latest curl output

```text
127.0.0.1:8080/login -> HTTP/1.1 500  (no Server header)                    = app server
127.0.0.1:8081/login -> HTTP/1.1 200  Last-Modified + ETag + Content-Length = static file
```

1. **The app server itself is failing.** `/login` on 8080 returns 500, so the
   running bundle throws while rendering. `deploy-frontend.sh` PASS only proved the
   port answers `/` — not that `/login` renders. The exact exception must be read
   from the process log first; if it is a missing runtime value, no rebuild fixes it.
2. **Nginx is not proxying at all.** `Last-Modified` (16:35), `ETag` and a fixed
   `Content-Length` mean nginx served `index.html` from disk instead of forwarding to
   8080. That stale file is what references the missing hashed assets — exactly the
   browser 404s you saw.

So the login page is broken twice over: the HTML comes from an old file, and the
server that should render it errors.

The backend/gateway is fine and is not touched by any step below.

## Recovery

0. **First capture the 500 — do not rebuild blind:**

   ```bash
   pm2 logs Qty_App --lines 80 --nostream
   curl -s http://127.0.0.1:8080/login | head -40
   ```

   This names the failing module or missing variable. If it is a runtime/config
   problem rather than a build problem, the plan is adjusted at that point.

1. **Do not deploy the failed `build:dev` output.** On the build machine, update
   the whole project source first; copying only a previous `dist` also copies its
   old deploy helper.

2. **On the build machine**, first confirm you are in the complete, latest source
   checkout—not inside `dist/`:

   ```bash
   pwd
   test -f package.json && test -f scripts/build.mjs \
     && test -f scripts/collect-dist.mjs && test -f scripts/deploy-frontend.sh
   ```

   If any test fails, stop: that machine does not have the current project source.
   From this project root, produce the Quality-server build using the required command:

   ```bash
   rm -rf dist .output .wrangler
   npm ci
   npm run build:selfhost
   ```

   The command must finish with exit code 0. The earlier `build:dev exited with
   code 1` output is a failed build and must never be copied. Do **not** use
   `npm run build` or `npm run build:dev` for this server. Confirm before copying:

   ```bash
   test -f dist/start.mjs && test -f dist/build-info.json \
     && test -f dist/deploy-frontend.sh && test -f dist/server/index.mjs
   cat dist/build-info.json
   ```

   It must say `"mode": "selfhost-node"`. This mode intentionally has no static
   root `index.html`; HTML is rendered by the matching server bundle.

   Create one transport archive only after all checks pass:

   ```bash
   tar -C dist -czf quality-frontend-dist.tar.gz .
   ```

3. **Transfer that one archive**, rather than selecting files/folders manually in
   WinSCP. On the server, preserve the current folder, extract into a new empty
   folder, and switch it into place:
   stale assets that cause the 404s):

   ```bash
   cd /data/webapplication/resl_approval/Quality/frontend
   mv dist "dist-broken-$(date +%Y%m%d-%H%M%S)"
   mkdir dist
   tar -xzf quality-frontend-dist.tar.gz -C dist
   test -f dist/build-info.json && test -f dist/deploy-frontend.sh
   ```

   Do not rename one of the three old folders into place, and do not copy files
   over the top with WinSCP merge mode. If either final `test` fails, the archive
   itself is incomplete; stop and rebuild it at step 2.

4. **On the server**, verify that it is the new bundle, then start it:

   ```bash
   cd /data/webapplication/resl_approval/Quality/frontend/dist
   cat build-info.json
   bash deploy-frontend.sh
   ```

   Expected deploy step 1 includes `OK build-info.json` (not `OK index.html`).
   Step 7 must include `/login renders and all its assets exist`, followed by
   `RESULT: PASS`.

5. **Nginx on 8081** must proxy `location /` to `127.0.0.1:8080` (not serve
   `index.html` from disk). If it still has a static `root`/`try_files` block,
   replace it with the block in §4 of `DEPLOY-QUALITY.md` and `nginx -s reload`.

6. **Final verification** from the server:

   ```bash
   curl -I http://127.0.0.1:8080/login
   curl -I http://127.0.0.1:8081/login
   ```

   Both must return 200. Then open a private/incognito browser window to avoid
   the old service worker/cache and load `http://10.150.150.130:8081/login`.

## Code hardening

- Make the deploy helper refuse any static `index.html` in a self-host bundle and
  print an explicit stale-script/mixed-build diagnosis.
- Add a `npm run verify:dist` script that checks a local `dist/` for
  `start.mjs`, `build-info.json` mode, and dangling asset references — so a bad folder
  is caught before it is ever copied to the server.
- Make `build:selfhost` run that verifier automatically before reporting success.
- Add a packaging command that emits a single verified
  `quality-frontend-dist.tar.gz`, eliminating partial/manual folder copies.

No application, database, middleware or gateway logic is changed.
