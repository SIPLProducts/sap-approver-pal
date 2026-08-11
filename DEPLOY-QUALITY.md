# Quality deployment (10.150.150.130)

## 1. Build (any machine with Node 20+)

```bash
npm ci
npm run build:selfhost
```

Use `build:selfhost` for this server. It builds the app server as a **plain Node
HTTP server** (`dist/server/index.mjs`) instead of a Cloudflare worker bundle —
no wrangler, no `workerd` binary, no `.runtime` install, and `process.env` is
visible to server code (which the SAP middleware callback needs).

Output — a single, clean `dist/` folder. No `.output/`, no `.wrangler/`, no duplicate
`dist/client/`; the build removes them itself. `dist/` is the only artefact you copy
to the server.

```text
dist/
  assets/                 <- hashed JS/CSS
  favicon.png
  manifest.webmanifest
  sw.js
  _headers
  build-info.json         <- build mode + fingerprint (the deploy helper checks it)
  server/                 <- app server bundle (SSR + all server functions)
  start.mjs               <- Node HTTP server: loads .env.runtime, serves dist/, calls server/
  .env.runtime            <- generated from frontend/.env (server-side keys)
  ecosystem.config.cjs    <- pm2 config (name Qty_App, port 8080)
  deploy-frontend.sh      <- one-command bring-up + checks
```

> There is **no static `index.html`** in a self-host build, and that is deliberate.
> A static shell is produced by a different Vite pass than `assets/`, so its hashed
> `<script>` names do not exist in the final `assets/` folder — that combination is
> exactly what causes "404 on every `/assets/*.js`" in the browser. The app server
> renders the HTML, so nginx must proxy `location /` to 8080 (see §5) instead of
> using `try_files ... /index.html`.
>
> `dist/server` must run: SAP login, PR/PO/ZNFA release, MIGO, user management,
> e-mail and push are server functions at `/_serverFn/*` (plus `/api/*`).

The build fails instead of emitting a mixed folder: after collecting `dist/` it
verifies that every `/assets/...` file referenced by shipped HTML actually exists.

## 2. Ship and run

```bash
# copy the whole dist folder — --delete is required, never merge into an old dist/
rsync -a --delete dist/ root@10.150.150.130:/data/webapplication/resl_approval/Quality/frontend/dist/

# on the server (Node 20+; nothing else to install)
cd /data/webapplication/resl_approval/Quality/frontend/dist
bash deploy-frontend.sh
```

Without `--delete`, stale chunks from an older build stay behind and the browser
keeps requesting files that no longer match this build.


`deploy-frontend.sh` regenerates `.env.runtime` from `frontend/.env`, verifies the
required keys, starts/restarts pm2 `Qty_App` on 8080, and runs the checks. It never
touches the SAP middleware on 3002.

Manual equivalent:

```bash
cd /data/webapplication/resl_approval/Quality/frontend/dist
pm2 start ecosystem.config.cjs      # or: pm2 restart Qty_App --update-env
pm2 save && pm2 startup             # reboot persistence
systemctl enable nginx
```

Required in `frontend/.env` (baked into `dist/.env.runtime` at build time):

```ini
SUPABASE_URL=http://10.150.150.130:8000
SUPABASE_PUBLISHABLE_KEY=<ANON_KEY from backend/.env>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from backend/.env — NOT the anon key>
MIDDLEWARE_URL=http://127.0.0.1:3002
MIDDLEWARE_SHARED_SECRET=<exact value from middleware/.env>
```

The launcher decodes `SUPABASE_SERVICE_ROLE_KEY` and prints
`warning: ... holds a 'anon' key` when the wrong key is used — sessions cannot be
created in that state.

Verify:

```bash
curl -I http://10.150.150.130:8081/                                  # frontend 200
ss -lntp | grep ':8080'                                              # node listening
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  http://127.0.0.1:8080/api/public/middleware/config                 # 401 = alive
curl -s http://127.0.0.1:3002/__health                               # middleware OK
```


systemd alternative — `/etc/systemd/system/resl-app-quality.service`:

```ini
[Unit]
Description=RESL Approval App (Quality)
After=network.target

[Service]
WorkingDirectory=/data/webapplication/resl_approval/Quality/frontend
Environment=PORT=8080
Environment=HOST=127.0.0.1
ExecStart=/usr/bin/npm start
Restart=always

[Install]
WantedBy=multi-user.target
```

## 3. Nginx (listens on 8081)

```nginx
server {
    listen 8081;
    server_name 10.150.150.130;

    client_max_body_size 50m;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;

    # No `root`/`index` here: the app server renders the HTML and serves
    # /assets/ itself with immutable caching. Serving a stale static index.html
    # from disk is what produced the "404 on every /assets/*.js" failure.



    # server functions + API routes -> app server (SAP, login, e-mail, push)
    location /_serverFn/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_read_timeout 300s;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_read_timeout 300s;
    }

    # middleware (SAP proxy)
    location /mw/ {
        proxy_pass http://127.0.0.1:3002/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    # Supabase API gateway (Kong)
    location /supabase/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Supabase Studio
    location /studio/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # everything else (pages + /assets/) -> app server on 8080
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_read_timeout 300s;
    }


}
```

Reload: `nginx -t && systemctl reload nginx`

## 4. App URLs

| What | URL |
|---|---|
| Application | http://10.150.150.130:8081/ |
| Middleware | http://10.150.150.130:8081/mw/ |
| Supabase API | http://10.150.150.130:8081/supabase/ |
| Supabase Studio | http://10.150.150.130:8081/studio/ |

In **SAP API Settings**, keep "Via Proxy" enabled and set the middleware URL to
`http://10.150.150.130:3002` (or `http://10.150.150.130:8081/mw`).
