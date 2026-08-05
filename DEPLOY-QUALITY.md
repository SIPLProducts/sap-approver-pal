# Quality deployment (10.150.150.130)

## 1. Build (any machine with Node 20+)

```bash
npm ci
npm run build
```

Output — a single, clean `dist/` folder. No `.output/`, no `.wrangler/`, no duplicate
`dist/client/`; the build removes them itself. `dist/` is the only artefact you copy
to the server.

```text
dist/
  index.html              <- static app shell (nginx `index index.html`)
  assets/                 <- hashed JS/CSS (serve directly from nginx)
  favicon.ico
  manifest.webmanifest
  sw.js
  _headers
  .assetsignore
  server/                 <- app server bundle (all server functions)
```

> `dist/index.html` is a real file, so nginx can use
> `root .../frontend/dist; index index.html;`.
> `dist/server` must still run: SAP login, PR/PO/ZNFA release, MIGO, user
> management, e-mail and push are server functions called at `/_serverFn/*`
> (plus `/api/*`), and nginx has to proxy those two prefixes to it.



## 2. Ship and run

```bash
# copy the whole dist folder
rsync -a dist/ root@10.150.150.130:/data/webapplication/resl_approval/Quality/frontend/dist/

# on the server (Node 20+ installed, project node_modules present for wrangler)
cd /data/webapplication/resl_approval/Quality/frontend
PORT=8080 HOST=127.0.0.1 npm start
```

pm2 (recommended):

```bash
pm2 start npm --name resl-app-quality -- start --  # env below
pm2 set resl-app-quality:PORT 8080
pm2 save
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

    root /data/webapplication/resl_approval/Quality/frontend/dist;
    index index.html;

    # hashed assets straight from disk
    location /assets/ {
        access_log off;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

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

    # app routes -> static shell (client-side routing)
    location / {
        try_files $uri $uri/ /index.html;
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
