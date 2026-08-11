# Blank page: HTML now comes from the app server, but nginx serves the wrong assets folder

Progress: `curl http://127.0.0.1:8081/login` returns **server-rendered HTML** with
the correct title and meta tags, so nginx -> app server (8080) is working. Only
the JS files 404.

## What the evidence shows

The rendered page asks for `/assets/index-BefOrEbA.js`. Your `ls assets` listing
shows a completely different set of hashed files (`activity-C59NuROP.js`,
`admin.users-mcxMcUJk.js`, …) — so the `dist/assets/` folder that nginx serves
belongs to a **different build pass** than the server bundle now rendering the
page. The self-host Node bundle carries/serves its own matching client assets;
nginx's `location /assets/ { try_files $uri =404; }` intercepts those requests
first and 404s them.

Confirm which folder actually holds the file the page wants:

```bash
cd /data/webapplication/resl_approval/Quality/frontend/dist
find . -name 'index-BefOrEbA.js' -printf '%p\n'
ls server
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/assets/index-BefOrEbA.js
```

- If the last command prints `200`, the app server has the right assets and nginx
  is simply looking in the wrong place.
- If it prints `404` too, then `dist/assets/` and `dist/server/` came from
  different builds and the folder must be rebuilt and recopied in one go.

## Fix A — nginx stops intercepting /assets/ (if 8080 returns 200)

Delete the static `location /assets/` block so everything goes to the app
server, which resolves asset URLs from its own manifest:

```nginx
root /data/webapplication/resl_approval/Quality/frontend/dist;

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

`sudo nginx -t && sudo systemctl reload nginx`, then hard-refresh (Ctrl-Shift-R).

## Fix B — rebuild so HTML and assets always match (if 8080 also 404s)

On your build machine, one clean build and one full copy:

```bash
npm ci
npm run build:selfhost
rsync -a --delete dist/ root@10.150.150.130:/data/webapplication/resl_approval/Quality/frontend/dist/
cd /data/webapplication/resl_approval/Quality/frontend/dist && bash deploy-frontend.sh
```

`--delete` is essential: a partial copy leaves an old `assets/` next to a new
`server/`, which is exactly this failure.

## Repo changes so this cannot recur

1. `scripts/build.mjs` / `scripts/collect-dist.mjs`: stop planting the pass-1
   static shell as `dist/index.html` for self-host builds — the app server
   renders HTML, and a stale shell can only ever disagree with `assets/`. Record
   the build mode in `dist/build-info.json` instead.
2. `scripts/collect-dist.mjs`: make sure the client assets emitted by the app
   pass are the only ones in `dist/assets/`, and record their manifest hash in
   `build-info.json`.
3. `scripts/deploy-frontend.sh`: new check — fetch `/` from the app server and
   assert every referenced `assets/*.js` resolves (either on disk or via 8080),
   failing with this exact diagnosis instead of reporting PASS on a blank page.
4. `DEPLOY-QUALITY.md`: add "page renders but all /assets/*.js 404" with both
   fixes above and the `rsync --delete` requirement.

Nothing touches the SAP middleware on 3002, Docker, or the database.
