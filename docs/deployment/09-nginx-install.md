# 09 — Nginx Installation

Nginx is the only public listener. It terminates TLS and reverse-proxies to the
loopback ports.

---

## 1. Install

```bash
sudo apt -y install nginx
nginx -v                              # nginx/1.24.x on Ubuntu 24.04
```

## 2. Enable and start the service

```bash
sudo systemctl enable nginx           # start on boot
sudo systemctl start nginx
sudo systemctl status nginx --no-pager
curl -I http://localhost              # 200 from the default page
```

## 3. Reload vs restart

```bash
sudo nginx -t                         # ALWAYS test the config first
sudo systemctl reload nginx           # graceful: no dropped connections
sudo systemctl restart nginx          # full stop/start: drops connections
sudo systemctl stop nginx
```

Rule: after editing any config, run `sudo nginx -t && sudo systemctl reload nginx`.
Use `restart` only when changing something a reload cannot apply (listening
sockets, `user`, loaded modules).

## 4. Where configuration lives

| Path | Purpose |
|---|---|
| `/etc/nginx/nginx.conf` | main config; `worker_processes`, includes |
| `/etc/nginx/conf.d/*.conf` | global snippets (gzip, upgrade map) |
| `/etc/nginx/sites-available/` | site definitions (all of them) |
| `/etc/nginx/sites-enabled/` | symlinks to the **active** sites |
| `/data/webapplication/resl_approval/nginx/` | our source-of-truth files, symlinked into `sites-available` |

We keep the real files under `/data/.../nginx/` so they are version-controlled
and backed up with the rest of the deployment, then symlink them into
`/etc/nginx`.

Remove the default site so it cannot answer for unknown hostnames:

```bash
sudo rm -f /etc/nginx/sites-enabled/default
```

## 5. Baseline main-config tuning

```bash
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak
```

Inside the `http { }` block of `/etc/nginx/nginx.conf`, confirm or set:

```nginx
worker_processes  auto;          # in the main context, one worker per CPU
events { worker_connections 4096; }

http {
    server_tokens off;           # do not advertise the version
    keepalive_timeout 65;
    types_hash_max_size 4096;
    server_names_hash_bucket_size 128;   # long hostnames

    # Our snippets and sites
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
```

## 6. Logs

| File | Contents |
|---|---|
| `/var/log/nginx/access.log` | default access log |
| `/var/log/nginx/error.log` | default error log |
| `/var/log/nginx/resl-quality-app.{access,error}.log` | Quality app (set per site in guide 10) |
| `/var/log/nginx/resl-quality-api.{access,error}.log` | Supabase API |
| `/var/log/nginx/resl-quality-mw.{access,error}.log` | SAP middleware |

```bash
sudo tail -f /var/log/nginx/resl-quality-app.error.log
sudo journalctl -u nginx -n 50 --no-pager        # service-level failures
```

Ubuntu's package already installs `/etc/logrotate.d/nginx` (daily, 14 days).

## 7. Verification

```bash
sudo nginx -t                          # syntax is ok
systemctl is-enabled nginx             # enabled
systemctl is-active nginx              # active
ss -ltnp | grep -E ':80|:443'          # nginx listening
```

Next: [10 — Nginx Quality Configuration](./10-nginx-quality-config.md)
