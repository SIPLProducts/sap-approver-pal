# Fix: self-host build serves assets from a folder that was deleted

## What is actually wrong

The build is fine — the packaging step is not. Two facts confirmed in the code:

- `vite.config.ts` tells the self-host server build that its static files live in `dist/client` (`publicDir: "dist/client"`), so the compiled Node server looks for `dist/client/assets/...` at runtime.
- `scripts/collect-dist.mjs` copies those files up to `dist/` root and then deletes `dist/client` (line 144).

Result: the server starts, `/login` renders (HTML is SSR'd), but every JS chunk request hits
`ENOENT ... dist\client\assets\activity-*.js` → HTTP 500, and `verify-dist` correctly refuses to ship the folder.
This is not the "121 assets" being missing — they exist at `dist/assets/`, just not where the server looks.

## The fix

1. In `vite.config.ts`, for the self-host branch only, point the nitro output `publicDir` at `dist`
   (instead of `dist/client`). The server then resolves static files to `dist/assets/...`, exactly
   where the collector leaves them — one copy, no duplication.
2. In `scripts/collect-dist.mjs`, make the flatten/delete step tolerant of both layouts:
   if `dist/client` exists, flatten and remove it as today; if it does not (new self-host layout),
   skip silently instead of warning. Keep the `.assetsignore`, `wrangler.json` rewrite and everything
   else unchanged.
3. Safety net: if step 1 turns out to bake a different relative path than expected, fall back to
   keeping `dist/client/assets` in place for self-host builds (assets present in both locations)
   so the server always finds them.

## Verification

- `npm run build:selfhost` from the project root.
- `verify-dist` must report `/login` HTTP 200 **and** `served /assets/<chunk>.js` (currently the FAIL line).
- Additionally check a second, deeper chunk and `/manifest.webmanifest` return 200 during the boot test,
  so a single lucky asset cannot mask a path mismatch.

## Then redeploy on the Quality server

```
cd /data/webapplication/resl_approval/Quality/frontend
bash deploy-frontend.sh
```

## Technical notes

- No application/source code changes — only `vite.config.ts` (self-host nitro output block) and
  `scripts/collect-dist.mjs`; optionally one extra assertion in `scripts/verify-dist.mjs`.
- The worker/preview build path (`SELF_HOST` unset) is untouched, so Lovable preview and publish are unaffected.
- Nginx guidance stays the same: `location /` proxies to port 8080; the Node app server renders HTML and serves assets.
