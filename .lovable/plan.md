# Get the Quality login page back up

## What the `ls` output proves

The folder on the server is a **stale, wrong-mode build**:

```text
assets  favicon.png  _headers  index.html  manifest.webmanifest  server  sw.js
```

A current self-host build always also contains `start.mjs`, `build-info.json`,
`deploy-frontend.sh` and `.assetsignore`. None of them are there — so this `dist/`
was produced by `npm run build` (Cloudflare Worker mode) on an older code version.
That explains both symptoms:

- nothing can start the app server (no `start.mjs`), so port 8080 has no listener
- the old `index.html` references asset hashes that no longer exist -> 404s, blank login page

The backend/gateway is fine and is not touched by any step below.

## Fix (no code change needed — this is a deploy step)

1. **On your local machine**, from the project folder, produce a clean bundle:

   ```bash
   rm -rf dist .output .wrangler
   npm run build:selfhost
   ```

   Confirm before copying: `dist/start.mjs`, `dist/build-info.json`,
   `dist/deploy-frontend.sh`, `dist/server/index.mjs` all exist, and
   `build-info.json` says `"mode": "selfhost-node"`.

2. **Replace the server folder atomically** (the `--delete` is what removes the
   stale assets that cause the 404s):

   ```bash
   rsync -a --delete dist/ root@10.150.150.130:/data/webapplication/resl_approval/Quality/frontend/dist/
   ```

3. **On the server**, bring the app server up:

   ```bash
   cd /data/webapplication/resl_approval/Quality/frontend/dist
   bash deploy-frontend.sh
   ```

   Expected: `RESULT: PASS`, port 8080 answering, `/login` rendering with all
   assets present.

4. **Nginx on 8081** must proxy `location /` to `127.0.0.1:8080` (not serve
   `index.html` from disk). If it still has a static `root`/`try_files` block,
   replace it with the block in §4 of `DEPLOY-QUALITY.md` and `nginx -s reload`.

## Small hardening I will add in code

- `scripts/deploy-frontend.sh` already refuses a mismatched folder; I will also make
  it detect the "worker-mode / missing `start.mjs`" case with a single explicit message
  naming the exact rebuild command, instead of "No such file or directory".
- Add a `npm run verify:dist` script that checks a local `dist/` for
  `start.mjs`, `build-info.json` mode, and dangling asset references — so a bad folder
  is caught before it is ever copied to the server.

No application, database, middleware or gateway logic is changed.
