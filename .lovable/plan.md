# Confirmed: dist/assets and dist/server come from different builds

Two independent things need attention. The blank page is the first one.

## 1. Blank page — asset/server mismatch (confirmed)

Your commands proved it:

- `find . -name 'index-BefOrEbA.js'` printed **nothing** — the file the rendered
  page asks for does not exist anywhere in `dist/`.
- `curl http://127.0.0.1:8080/assets/index-BefOrEbA.js` returned **500**, so the
  app server cannot serve it either.
- `ls assets` shows a completely different hash set
  (`activity-C59NuROP.js`, `admin.users-mcxMcUJk.js`, …).

So `dist/server/` (whose client manifest names `index-BefOrEbA.js`) and
`dist/assets/` were produced by two different build runs, and this folder was
assembled from a partial copy. No nginx tweak can fix that — the file simply
isn't there.

### Fix: one clean build, one full copy

On your build machine:

```bash
npm ci
rm -rf dist .output .wrangler
npm run build:selfhost
grep -ao 'assets/[^"]*\.js' dist/server/_tanstack-start-manifest_v-*.mjs | sort -u | head
ls dist/assets | head
```

The names from the manifest must exist in `dist/assets/` **before** you copy.
Then copy with `--delete` so no stale `assets/` survives next to a new `server/`:

```bash
rsync -a --delete dist/ root@10.150.150.130:/data/webapplication/resl_approval/Quality/frontend/dist/
```

On the server:

```bash
cd /data/webapplication/resl_approval/Quality/frontend/dist
bash deploy-frontend.sh
curl -s --compressed http://127.0.0.1:8081/login | grep -ao 'assets/[^"]*\.js' | sort -u \
  | while read f; do [ -f "$f" ] && echo "OK   $f" || echo "MISS $f"; done
```

All `OK`, then hard-refresh the browser (Ctrl-Shift-R).

Keep nginx as it is now (`location /` proxying to 8080) — the server-rendered
HTML you got back is correct and is what we want.

## 2. Backend gateway is down: `supabase-kong is unhealthy`

Separate problem, and it will block login even after the page loads, because the
app talks to the database through Kong on port 8000. Diagnose with:

```bash
cd /data/webapplication/resl_approval/Quality/backend
docker compose -p resl_quality logs --tail 60 kong
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/auth/v1/health
```

Kong renders its config from `backend/.env` at start-up, so its log usually names
the exact missing or malformed variable (typically the API-key values). Once the
log line is in front of us I can say which value to correct — I don't want to
guess at it.

## Repo changes so the mismatch cannot recur

1. `scripts/collect-dist.mjs`: after assembling `dist/`, read the client manifest
   in `dist/server/` and assert every referenced `assets/*` file exists; fail the
   build with the missing names instead of shipping a broken folder.
2. `scripts/collect-dist.mjs`: write `dist/build-info.json` with the build mode
   (`node-server` vs worker) and a manifest fingerprint.
3. `scripts/deploy-frontend.sh`: compare that fingerprint against the on-disk
   `assets/` and stop with "dist/server and dist/assets are from different
   builds — rebuild with `npm run build:selfhost` and copy with `rsync --delete`"
   rather than reporting PASS on a blank page.
4. Stop planting the pass-1 static shell as `dist/index.html` for self-host
   builds — the app server renders HTML, so the shell can only ever disagree.
5. `DEPLOY-QUALITY.md`: add "page renders but all /assets/*.js 404" with this
   diagnosis, plus the `rsync --delete` requirement.

Nothing touches the SAP middleware on 3002 or the database schema.
