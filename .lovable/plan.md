# Quality Nginx — single host, path-based config

One Nginx vhost for the Quality environment, serving everything under one hostname (e.g. `quality.example.com`) with paths instead of subdomains.

## Port map

| Path | Upstream | Port |
|---|---|---|
| `/` (app + its own `/api/*`) | TanStack Start SSR | 8081 |
| `/supabase/` | Supabase API gateway (Kong) | 8000 |
| `/studio/` | Supabase Studio | 3000 |
| `/mw/` | SAP middleware | 3002 |

Port 8080 is not used: the app's `/api/*` server functions are served by the same SSR process on 8081, so no separate `location /api` upstream is needed. `/api/` will simply fall through to the app block.

## What the config file will contain

- `deploy/quality/nginx/resl-approval-quality-single-host.conf` — one file, fully commented:
  - HTTP :80 → HTTPS redirect, plus commented alternative for a plain-HTTP internal box.
  - TLS block with Let's Encrypt paths and a commented internal-CA variant.
  - Security headers, `client_max_body_size 50m`, 300s proxy/send/read timeouts (must stay ≥ middleware `SAP_REQUEST_TIMEOUT_MS`).
  - `location /assets/` — immutable 1-year caching.
  - `location ~* ^/(sw\.js|manifest\.webmanifest)$` — `no-cache` so PWA updates land.
  - `location /supabase/` — proxy to `127.0.0.1:8000` with the `/supabase` prefix stripped, WebSocket upgrade headers for Realtime, no buffering.
  - `location /studio/` — proxy to `127.0.0.1:3000`, gated by HTTP basic auth (`/etc/nginx/.htpasswd-studio`) since Studio has no login.
  - `location /mw/` — proxy to `127.0.0.1:3002` with prefix stripped, long SAP timeouts, buffering off.
  - `location /` — SSR catch-all to `127.0.0.1:8081` (covers `/api/*`), no SPA `try_files`.
  - Upstream blocks with `keepalive` for the app.
- The shared `00-upgrade-map.conf` (`$connection_upgrade` map) already exists in `deploy/quality/nginx/` and stays as-is; the new file depends on it being linked into `conf.d`.

## Notes affecting app env (documented in the file header, no code changes)

Because Supabase now lives on a path rather than its own host:
- `VITE_SUPABASE_URL` must be `https://<host>/supabase`
- middleware base URL becomes `https://<host>/mw`

## Docs

Update `docs/deployment/10-nginx-quality-config.md` with a short "single-host, path-based" section: the port table above, install/symlink commands, `nginx -t && systemctl reload nginx`, and the basic-auth setup for `/studio`.
