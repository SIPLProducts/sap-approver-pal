# Quality deployment (10.150.150.130)

## 1. Build (any machine with Node 20+)

```bash
npm ci
npm run build
```

Output — a single `dist/` folder:

```text
dist/
  assets/                 <- hashed JS/CSS (serve directly from nginx)
  favicon.ico
  manifest.webmanifest
  sw.js
  _headers
  client/                 <- same static files, used by the app server
  server/                 <- app server bundle (SSR + all server functions)
  nitro.json  package.json
```

> This app is not a static-only SPA. SAP login, PR/PO/ZNFA release, MIGO,
> user management, e-mail and push all run inside `dist/server`, so the app
> server process must run — nginx alone cannot serve the app.

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

    # hashed assets straight from disk
    location /assets/ {
        alias /data/webapplication/resl_approval/Quality/frontend/dist/assets/;
        access_log off;
        expires 1y;
        add_header Cache-Control "public, immutable";
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

    # everything else -> app server
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
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
