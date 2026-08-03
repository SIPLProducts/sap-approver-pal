# 03 — Nginx & TLS

Nginx is the only public entry point. It terminates TLS and proxies to the
containers on loopback ports.

## 1. Install

```bash
sudo apt -y install nginx
sudo systemctl enable --now nginx
curl -I http://localhost
```

## 2. Hostnames

Decide six names (drop any you do not need) and create DNS records pointing to
the server:

| Purpose | Example |
|---|---|
| Production app | `app.example.com` |
| Production Supabase API | `api.example.com` |
| Production middleware | `mw.example.com` |
| Quality app | `quality.example.com` |
| Quality Supabase API | `api-quality.example.com` |
| Quality middleware | `mw-quality.example.com` |

For an intranet-only server, use internal DNS names — they still work with an
internal CA (option B below).

## 3. Certificates

### Option A — Let's Encrypt (server reachable from the internet on 80/443)

```bash
sudo apt -y install certbot python3-certbot-nginx
sudo certbot certonly --nginx \
  -d app.example.com -d api.example.com -d mw.example.com \
  -d quality.example.com -d api-quality.example.com -d mw-quality.example.com
sudo systemctl list-timers | grep certbot     # auto-renewal
```

### Option B — internal CA or self-signed (intranet server)

```bash
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/resl.key -out /etc/nginx/ssl/resl.crt \
  -subj "/CN=app.example.com" \
  -addext "subjectAltName=DNS:app.example.com,DNS:api.example.com,DNS:mw.example.com,DNS:quality.example.com,DNS:api-quality.example.com,DNS:mw-quality.example.com"
sudo chmod 600 /etc/nginx/ssl/resl.key
```

Then in each server block replace the two `ssl_certificate*` lines with:

```nginx
ssl_certificate     /etc/nginx/ssl/resl.crt;
ssl_certificate_key /etc/nginx/ssl/resl.key;
```

and remove the two `include`/`ssl_dhparam` Certbot lines. Distribute the CA (or
the self-signed cert) to client machines, otherwise browsers will warn.

## 4. Install the server blocks

The configs ship in the repo at `deploy/data/nginx/` and were copied to
`/data/webapplication/resl_approval/nginx/` in step 01.

```bash
cd /data/webapplication/resl_approval/nginx
# Replace the placeholder hostnames with yours
sed -i 's/app\.example\.com/app.yourdomain.com/g; s/api\.example\.com/api.yourdomain.com/g; \
        s/mw\.example\.com/mw.yourdomain.com/g; s/quality\.example\.com/quality.yourdomain.com/g; \
        s/api-quality\.example\.com/api-quality.yourdomain.com/g; \
        s/mw-quality\.example\.com/mw-quality.yourdomain.com/g' *.conf

# Link every server block. 00-upgrade-map.conf is NOT a server block —
# it belongs in conf.d (section 7), so skip it here.
for f in *.conf; do
  [ "$f" = "00-upgrade-map.conf" ] && continue
  sudo ln -sfn "$PWD/$f" "/etc/nginx/sites-enabled/${f%.conf}"
done
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Editing a file in `/data/.../nginx/` and reloading Nginx is now enough — the
symlinks keep `/etc/nginx` in sync.

## 5. Studio basic auth

Supabase Studio has no per-user auth. Put it behind HTTP basic auth:

```bash
sudo htpasswd -c /etc/nginx/.htpasswd-studio studioadmin
sudo chmod 640 /etc/nginx/.htpasswd-studio
sudo chown root:www-data /etc/nginx/.htpasswd-studio
```

The `*-supabase.conf` files already reference this file on the `/studio` path.

## 6. Timeouts — why 300s

Long SAP reports (BMW Status Report, large PO/PR fetches) can run for minutes.
Every hop must allow more time than the middleware's `SAP_REQUEST_TIMEOUT_MS`:

| Hop | Setting | Value used |
|---|---|---|
| Nginx | `proxy_read_timeout`, `proxy_send_timeout`, `send_timeout` | `300s` |
| Middleware | `SAP_REQUEST_TIMEOUT_MS` | `300000` |
| Any CDN in front | must not cap below that | put the middleware host on DNS-only |

A `504` from Nginx or a `524` from a CDN is a **gateway** timeout, not a SAP
error. Raise the hop that is lowest.

## 7. Body size and realtime

The shipped configs already set:

```nginx
client_max_body_size 50m;          # file uploads via Storage
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;   # realtime websockets
proxy_set_header Connection $connection_upgrade;
```

The `$connection_upgrade` map is defined once in
`deploy/data/nginx/00-upgrade-map.conf`, which is symlinked into
`/etc/nginx/conf.d/`:

```bash
sudo ln -sfn /data/webapplication/resl_approval/nginx/00-upgrade-map.conf \
             /etc/nginx/conf.d/00-upgrade-map.conf
sudo nginx -t && sudo systemctl reload nginx
```

## 8. Verify

Containers do not exist yet, so a `502` here is expected and proves routing
works:

```bash
curl -kI https://quality.yourdomain.com
curl -kI https://mw-quality.yourdomain.com/__health
sudo nginx -t
```

Next: [04 — Self-hosted Supabase](./04-supabase-selfhost.md)
