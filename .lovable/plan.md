# Corrected nginx config for the Quality server (port 8081)

Your config is now structurally right — `/_serverFn/` and `/api/` are present and above `location /`. Two things to fix, then the full file below is what to paste in.

## What was wrong

1. **`/assets/` is placed after `/api/` but has no `try_files`** — prefix locations are matched by longest prefix, not order, so this one is fine, but without `try_files` a missing asset returns nginx's default 404 page instead of a clean 404. Harmless; kept as-is with `try_files` added.
2. **`add_header` inside a location wipes the server-level `add_header` directives.** In `/mw/` you add `Cache-Control`, which silently drops `X-Frame-Options`, `X-Content-Type-Options` and `Referrer-Policy` for that path. Same for `/assets/`. The corrected file repeats the security headers where needed.

Everything else — upstreams, the `$connection_upgrade` map, `Connection ""` for keepalive upstreams, `proxy_buffering off` on the SAP paths — is correct.

## Full corrected config

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

upstream supabase_api    { server 127.0.0.1:8000; keepalive 16; }
upstream supabase_studio { server 127.0.0.1:3000; }
upstream middleware_api  { server 127.0.0.1:3002; keepalive 16; }
upstream app_server      { server 127.0.0.1:8080; keepalive 16; }

server {
    listen 8081;
    server_name 10.150.150.130;

    root  /data/webapplication/resl_approval/Quality/frontend/dist;
    index index.html;

    server_tokens off;
    client_max_body_size 50M;

    access_log /data/webapplication/resl_approval/Quality/logs/access.log;
    error_log  /data/webapplication/resl_approval/Quality/logs/error.log;

    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 5;
    gzip_types text/plain text/css application/json application/javascript image/svg+xml;

    # ---- app server: server functions (SAP login, releases, MIGO, e-mail, push)
    location /_serverFn/ {
        proxy_pass http://app_server;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_connect_timeout 30s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # ---- app server: API routes (public hooks, middleware config/log)
    location /api/ {
        proxy_pass http://app_server;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_connect_timeout 30s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # ---- Supabase API gateway (Kong)
    location /supabase/ {
        proxy_pass http://supabase_api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_connect_timeout 30s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_buffering off;
    }

    # ---- Supabase Studio
    location /studio/ {
        auth_basic "RESL Quality Studio";
        auth_basic_user_file /etc/nginx/.htpasswd-studio;

        proxy_pass http://supabase_studio/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 300s;
    }

    # ---- SAP middleware
    location /mw/ {
        proxy_pass http://middleware_api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        add_header X-Frame-Options SAMEORIGIN always;
        add_header X-Content-Type-Options nosniff always;
        add_header Referrer-Policy strict-origin-when-cross-origin always;
        add_header Cache-Control "no-store" always;

        proxy_connect_timeout 30s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        send_timeout 300s;
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # ---- hashed build assets
    location /assets/ {
        access_log off;
        try_files $uri =404;

        add_header X-Content-Type-Options nosniff always;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
    }

    # ---- service worker / manifest: never cache the shell registration
    location = /sw.js {
        try_files $uri =404;
        add_header Cache-Control "no-store" always;
    }

    # ---- app routes -> static shell (client-side routing)
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## Apply it

```bash
nginx -t && systemctl reload nginx
```

## Still required: the app server on 8080

`/_serverFn/` and `/api/` proxy to `127.0.0.1:8080`. If nothing listens there you get **502 Bad Gateway** (not 405). Start and verify:

```bash
cd /data/webapplication/resl_approval/Quality/frontend
pm2 start npm --name Qty-App -- start
pm2 save
ss -ltnp | grep 8080
```

The `npm start` script must run with `PORT=8080 HOST=127.0.0.1`.

## Verify end to end

```bash
curl -i -X POST http://10.150.150.130:8081/_serverFn/ping
curl -i http://10.150.150.130:8081/supabase/auth/v1/health
```

Neither should return nginx's 405 page. Then open `http://10.150.150.130:8081/` and sign in — the login form posts to `/_serverFn/*`, which calls the SAP `Login_API` through the middleware, and the backend stack only issues the session afterwards.
