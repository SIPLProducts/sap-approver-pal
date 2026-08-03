# 10 — Nginx Configuration (Quality only)

Three public hostnames, three server blocks, plus two shared snippets.

| Hostname | Proxies to | File |
|---|---|---|
| `quality.example.com` | app + its API — `127.0.0.1:3000` | `resl-approval-quality` |
| `api-quality.example.com` | Supabase Kong — `127.0.0.1:8000`, Studio `:3001` | `resl-approval-quality-supabase` |
| `mw-quality.example.com` | SAP middleware — `127.0.0.1:3005` | `resl-approval-quality-middleware` |

Source files ship in the repository at `deploy/quality/nginx/`.

---

## 1. Install the files

```bash
sudo -iu deploy
cd /data/webapplication/resl_approval/nginx
# copy deploy/quality/nginx/*.conf from the repo checkout into this folder
cp /data/webapplication/resl_approval/Quality/frontend/repo/deploy/quality/nginx/*.conf .

# Replace placeholder hostnames with yours
sed -i 's/quality\.example\.com/quality.yourdomain.com/g;
        s/api-quality\.yourdomain\.com/api-quality.yourdomain.com/g;
        s/api-quality\.example\.com/api-quality.yourdomain.com/g;
        s/mw-quality\.example\.com/mw-quality.yourdomain.com/g' *.conf
```

Then link them. Global snippets go to `conf.d`, sites to
`sites-available` + `sites-enabled`:

```bash
sudo ln -sfn /data/webapplication/resl_approval/nginx/00-upgrade-map.conf \
             /etc/nginx/conf.d/00-upgrade-map.conf
sudo ln -sfn /data/webapplication/resl_approval/nginx/01-gzip.conf \
             /etc/nginx/conf.d/01-gzip.conf

for s in resl-approval-quality resl-approval-quality-supabase resl-approval-quality-middleware; do
  sudo ln -sfn "/data/webapplication/resl_approval/nginx/$s.conf" "/etc/nginx/sites-available/$s"
  sudo ln -sfn "/etc/nginx/sites-available/$s" "/etc/nginx/sites-enabled/$s"
done

sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Exact placement, as requested:

```text
/etc/nginx/sites-available/resl-approval-quality              -> /data/.../nginx/resl-approval-quality.conf
/etc/nginx/sites-enabled/resl-approval-quality                -> /etc/nginx/sites-available/resl-approval-quality
/etc/nginx/conf.d/00-upgrade-map.conf                         -> /data/.../nginx/00-upgrade-map.conf
```

Editing the file under `/data/.../nginx/` and reloading Nginx is now enough.

---

## 2. TLS certificates

### Option A — Let's Encrypt (server reachable on 80/443 from the internet)

```bash
sudo apt -y install certbot python3-certbot-nginx
sudo certbot certonly --nginx \
  -d quality.yourdomain.com \
  -d api-quality.yourdomain.com \
  -d mw-quality.yourdomain.com
systemctl list-timers | grep certbot        # auto-renewal timer
```

### Option B — internal CA / self-signed (intranet server)

```bash
cd /data/webapplication/resl_approval/Quality/ssl
openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout resl-quality.key -out resl-quality.crt \
  -subj "/CN=quality.yourdomain.com" \
  -addext "subjectAltName=DNS:quality.yourdomain.com,DNS:api-quality.yourdomain.com,DNS:mw-quality.yourdomain.com"
chmod 600 resl-quality.key
```

Then in each server block swap the certificate lines for the commented
alternatives already present:

```nginx
ssl_certificate     /data/webapplication/resl_approval/Quality/ssl/resl-quality.crt;
ssl_certificate_key /data/webapplication/resl_approval/Quality/ssl/resl-quality.key;
```

and delete the two Certbot `include` / `ssl_dhparam` lines. Distribute the CA
certificate to client machines or browsers will warn.

---

## 3. Shared snippet — `00-upgrade-map.conf`

```nginx
# WebSocket / SSE upgrade map, shared by every server block.
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
```

Why: `proxy_set_header Connection "upgrade"` unconditionally would break plain
HTTP keep-alive. This map sends `upgrade` only when the client actually asked
for it. Needed for Supabase Realtime.

## 4. Shared snippet — `01-gzip.conf`

```nginx
gzip              on;
gzip_vary         on;        # emit "Vary: Accept-Encoding" so caches behave
gzip_comp_level   5;         # good ratio without burning CPU
gzip_min_length   1024;      # tiny bodies get bigger when compressed
gzip_proxied      any;       # compress even proxied upstream responses
gzip_types
    text/plain text/css text/xml text/javascript
    application/javascript application/json application/xml
    application/rss+xml application/wasm
    image/svg+xml font/woff font/woff2;
# NOTE: images (png/jpg/webp) and woff2 are already compressed — listing them
# only wastes CPU; woff/woff2 kept because some toolchains ship uncompressed.
```

---

## 5. Site — `resl-approval-quality.conf` (app + API)

```nginx
# ---------------------------------------------------------------------------
# RESL Approval — QUALITY app (TanStack Start SSR: frontend AND its own API)
# Upstream: PM2 process "resl-quality-app" on 127.0.0.1:3000
# ---------------------------------------------------------------------------

upstream resl_quality_app {
    server 127.0.0.1:3000;
    keepalive 32;              # reuse upstream connections; cuts latency
}

# Plain HTTP: only redirect.
server {
    listen 80;
    listen [::]:80;
    server_name quality.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;                                  # multiplexing for many assets
    server_name quality.example.com;

    # ---- TLS (Option A: Let's Encrypt) ----
    ssl_certificate     /etc/letsencrypt/live/quality.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/quality.example.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;
    # ---- TLS (Option B: internal CA) — replace the four lines above with ----
    # ssl_certificate     /data/webapplication/resl_approval/Quality/ssl/resl-quality.crt;
    # ssl_certificate_key /data/webapplication/resl_approval/Quality/ssl/resl-quality.key;
    # ssl_protocols       TLSv1.2 TLSv1.3;
    # ssl_ciphers         HIGH:!aNULL:!MD5;

    ssl_session_cache   shared:SSL:10m;        # resume handshakes cheaply
    ssl_session_timeout 1d;
    ssl_stapling        on;                    # OCSP stapling (Option A only)
    ssl_stapling_verify on;

    # ---- Security headers ----
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options    "nosniff" always;
    add_header X-Frame-Options           "SAMEORIGIN" always;   # allow our own iframes only
    add_header Referrer-Policy           "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy        "geolocation=(), microphone=(), camera=()" always;
    # CSP is intentionally NOT enforced: the app loads Cloudscape styles and
    # inline SSR state. Add it in report-only mode first if you need it.

    # ---- Uploads ----
    client_max_body_size 50m;      # must be >= Supabase FILE_SIZE_LIMIT (50 MB)
    client_body_timeout  300s;     # slow clients uploading large attachments
    client_body_buffer_size 1m;

    access_log /var/log/nginx/resl-quality-app.access.log;
    error_log  /var/log/nginx/resl-quality-app.error.log warn;

    # ---- Immutable hashed assets ----
    location /assets/ {
        proxy_pass http://resl_quality_app;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    # ---- PWA files that MUST revalidate ----
    location ~* ^/(sw\.js|manifest\.webmanifest)$ {
        proxy_pass http://resl_quality_app;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        add_header Cache-Control "no-cache, must-revalidate";
    }

    # ---- The application's own API: never cache, long timeouts ----
    location /api/ {
        proxy_pass http://resl_quality_app;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection        "";

        add_header Cache-Control "no-store" always;
        proxy_no_cache      1;
        proxy_cache_bypass  1;
        proxy_buffering     off;      # stream server-function responses
        proxy_request_buffering off;  # stream large uploads straight through

        # Long SAP-backed server functions. See the timeout rule in README.
        proxy_connect_timeout 30s;
        proxy_send_timeout   300s;
        proxy_read_timeout   300s;
        send_timeout         300s;
    }

    # ---- Everything else: SSR HTML ----
    location / {
        proxy_pass http://resl_quality_app;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        $connection_upgrade;

        proxy_connect_timeout 30s;
        proxy_send_timeout   300s;
        proxy_read_timeout   300s;
        send_timeout         300s;
        proxy_buffering off;

        # NO try_files / NO root: this is SSR, not a static SPA. Deep links and
        # refreshes are handled by the app, so no SPA fallback is required.
    }

    # Nginx must not swallow the app's own error pages
    proxy_intercept_errors off;
}
```

**Why there is no CORS block here:** the browser calls `/api/*` on the *same*
origin as the page. Cross-origin headers would be dead weight and a needless
loosening.

---

## 6. Site — `resl-approval-quality-supabase.conf`

```nginx
# ---------------------------------------------------------------------------
# Supabase API gateway (Kong) + Studio — QUALITY
# ---------------------------------------------------------------------------

server {
    listen 80;
    server_name api-quality.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name api-quality.example.com;

    ssl_certificate     /etc/letsencrypt/live/api-quality.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api-quality.example.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options    "nosniff" always;

    client_max_body_size 50m;          # Storage uploads
    access_log /var/log/nginx/resl-quality-api.access.log;
    error_log  /var/log/nginx/resl-quality-api.error.log warn;

    # ---- Studio: no per-user auth of its own, so gate it ----
    location /studio {
        auth_basic           "RESL Quality Studio";
        auth_basic_user_file /etc/nginx/.htpasswd-studio;

        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        $connection_upgrade;
        proxy_read_timeout 300s;
    }

    # ---- Kong: /rest, /auth, /storage, /realtime, /functions ----
    location / {
        # CORS: this IS a cross-origin API (the app runs on quality.example.com).
        # Kong emits its own CORS headers for most routes; these cover the rest.
        set $cors_origin "";
        if ($http_origin = "https://quality.example.com") { set $cors_origin $http_origin; }

        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin      $cors_origin always;
            add_header Access-Control-Allow-Credentials "true" always;
            add_header Access-Control-Allow-Methods     "GET, POST, PATCH, PUT, DELETE, OPTIONS" always;
            add_header Access-Control-Allow-Headers     "authorization, apikey, content-type, x-client-info, prefer, range" always;
            add_header Access-Control-Max-Age           1728000 always;
            add_header Content-Length 0;
            return 204;
        }

        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;      # Realtime websockets
        proxy_set_header Connection        $connection_upgrade;

        proxy_connect_timeout 30s;
        proxy_send_timeout   300s;
        proxy_read_timeout   300s;      # long-lived Realtime sockets
        send_timeout         300s;
        proxy_buffering off;            # do not buffer streamed responses
    }
}
```

Create the Studio password file:

```bash
sudo htpasswd -c /etc/nginx/.htpasswd-studio studioadmin
sudo chmod 640 /etc/nginx/.htpasswd-studio
sudo chown root:www-data /etc/nginx/.htpasswd-studio
```

---

## 7. Site — `resl-approval-quality-middleware.conf`

```nginx
# ---------------------------------------------------------------------------
# SAP middleware — QUALITY. Upstream: PM2 "resl-quality-mw" 127.0.0.1:3005
# Protected by MIDDLEWARE_SHARED_SECRET inside the application itself.
# ---------------------------------------------------------------------------

server {
    listen 80;
    server_name mw-quality.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name mw-quality.example.com;

    ssl_certificate     /etc/letsencrypt/live/mw-quality.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mw-quality.example.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options    "nosniff" always;

    client_max_body_size 25m;
    access_log /var/log/nginx/resl-quality-mw.access.log;
    error_log  /var/log/nginx/resl-quality-mw.error.log warn;

    # Optional hardening: restrict to your corporate ranges.
    # allow 10.0.0.0/8; allow 192.168.0.0/16; deny all;

    location / {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection        "";

        # MUST stay at or above the middleware's SAP_REQUEST_TIMEOUT_MS (300000).
        proxy_connect_timeout 30s;
        proxy_send_timeout   300s;
        proxy_read_timeout   300s;
        send_timeout         300s;
        proxy_buffering off;
    }
}
```

---

## 8. Directive reference

| Directive | What it does / why we set it |
|---|---|
| `listen 443 ssl; http2 on;` | TLS + HTTP/2 (Nginx 1.24 syntax; `listen ... http2` is deprecated) |
| `return 301 https://$host$request_uri` | one canonical scheme; preserves path and query |
| `proxy_pass` | forwards to the loopback upstream |
| `proxy_http_version 1.1` | required for keep-alive and WebSocket upgrades |
| `proxy_set_header Host $host` | upstream sees the public hostname, so redirects/cookies are correct |
| `X-Real-IP` / `X-Forwarded-For` | the real client IP reaches app logs and rate limits |
| `X-Forwarded-Proto $scheme` | the app knows it is behind HTTPS and builds `https://` URLs |
| `Upgrade` / `Connection $connection_upgrade` | enables WebSockets (Realtime) |
| `proxy_buffering off` | streams responses; long reports appear progressively |
| `proxy_request_buffering off` | large uploads stream instead of landing on disk first |
| `keepalive 32` in `upstream` | reuses TCP connections to the app |
| `proxy_connect_timeout 30s` | fail fast when the upstream is down (502 instead of a hang) |
| `proxy_read/send_timeout 300s` | matches `SAP_REQUEST_TIMEOUT_MS`; prevents spurious 504s |
| `client_max_body_size 50m` | uploads bigger than this get 413 |
| `expires 1y` + `immutable` | hashed assets are safe to cache forever |
| `Cache-Control no-store` on `/api/` | approval data must never be cached |
| `add_header ... always` | header is also sent on error responses |
| `Strict-Transport-Security` | forces HTTPS on subsequent visits |
| `X-Frame-Options SAMEORIGIN` | blocks clickjacking via foreign iframes |
| `nosniff` | stops MIME-type guessing |
| `auth_basic` on `/studio` | Studio has no login of its own |
| `server_tokens off` (main config) | hides the Nginx version |

---

## 9. Apply and verify

```bash
sudo nginx -t && sudo systemctl reload nginx

curl -sI  http://quality.yourdomain.com          | head -1   # 301
curl -sI  https://quality.yourdomain.com/login   | head -1   # 200
curl -s   https://mw-quality.yourdomain.com/__health         # {"ok":true}
curl -s -o /dev/null -w '%{http_code}\n' https://api-quality.yourdomain.com/rest/v1/   # 401
curl -sI  https://api-quality.yourdomain.com/studio | head -1 # 401 (basic auth)

# Cache headers on a hashed asset
curl -sI "https://quality.yourdomain.com/$(curl -s https://quality.yourdomain.com/login \
  | grep -o 'assets/[^\"]*\.js' | head -1)" | grep -i cache-control
```

Next: [11 — Environment Variables](./11-env-variables.md)
