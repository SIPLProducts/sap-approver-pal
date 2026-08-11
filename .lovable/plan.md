# Blank page with every /assets/*.js returning 404

The app server on 8080 is now healthy — this is a different problem, and it is
in the build, not in your server setup.

## Cause

`scripts/build.mjs` runs **two** Vite builds:

1. a "shell" pass, whose `index.html` is stashed aside;
2. the real "app" pass, which produces `dist/assets/*` and `dist/server/`.

`scripts/collect-dist.mjs` then drops the **pass-1** `index.html` into `dist/`
next to the **pass-2** assets. Each pass hashes filenames independently, so the
HTML asks for `assets/index-BefOrEbA.js` while the folder actually contains a
differently-hashed `assets/index-XXXXXXXX.js`. Nginx serves the HTML fine and
404s every script — exactly the console you pasted.

Quick confirmation on the server:

```bash
cd /data/webapplication/resl_approval/Quality/frontend/dist
grep -o 'assets/[^"]*\.js' index.html | head
ls assets | head
```

The names will not match.

## Fix: let the app server serve the HTML

The Node bundle on 8080 already renders the page and knows the correct asset
names. So the static shell should not be in the request path at all.

1. **Nginx (8081)** — change the catch-all so it proxies instead of serving the
   stale shell, and keep static assets on disk for speed:

   ```nginx
   root /data/webapplication/resl_approval/Quality/frontend/dist;

   location /assets/ { try_files $uri =404; access_log off; expires 1y; }

   location /_serverFn/ { proxy_pass http://127.0.0.1:8080; }
   location /api/       { proxy_pass http://127.0.0.1:8080; }
   location /mw/        { proxy_pass http://127.0.0.1:3002/; }
   location /supabase/  { proxy_pass http://127.0.0.1:8000/; }

   location / {
     proxy_pass http://127.0.0.1:8080;
     proxy_set_header Host $host;
     proxy_set_header X-Forwarded-Proto $scheme;
     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
   }
   ```

   Then `sudo nginx -t && sudo systemctl reload nginx`.

2. **Repo change (so the mismatch cannot come back)** — in
   `scripts/collect-dist.mjs`, when the self-host build is in effect, do not
   copy the pass-1 shell in as `dist/index.html`; instead write a
   `dist/build-info.json` noting that HTML is served by the app server, and have
   `scripts/deploy-frontend.sh` verify (a) `server/index.mjs` exists and (b) if
   an `index.html` is present, its referenced `assets/*.js` all exist on disk —
   failing loudly with this exact diagnosis when they do not.

3. **`DEPLOY-QUALITY.md`** — add a "blank page, all assets 404" entry naming the
   shell/asset hash mismatch and the nginx `location /` proxy as the fix.

Nothing touches the SAP middleware on 3002, Docker, or the database.

## Verify

```bash
curl -s http://127.0.0.1:8081/ | grep -o 'assets/[^"]*\.js' | head
```

Every name printed must exist under `dist/assets/`. Then reload the browser with
a hard refresh (Ctrl-Shift-R) and log in.
