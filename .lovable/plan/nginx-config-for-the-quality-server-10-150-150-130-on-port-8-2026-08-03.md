# Nginx config for the quality server — 10.150.150.130 on port 8081

Deliver a single standalone Nginx config file plus a PDF copy. No files under
`deploy/` or `docs/` are touched — the output goes straight to your downloads.

## Routing (port 80 is not used at all)

```text
http://10.150.150.130:8081/            -> frontend app (SSR + its own /api/*)
http://10.150.150.130:8081/supabase/   -> Supabase API gateway (Kong)  : 8000
http://10.150.150.130:8081/studio/     -> Supabase Studio (basic auth) : 3000
http://10.150.150.130:8081/mw/         -> SAP middleware               : 3002
http://10.150.150.130:8080/            -> optional alias, same routing
```

## One required change on the server

Nginx itself takes port 8081, so the app process cannot also bind 8081. The app
moves to an internal port `8082` (`PORT=8082` in its env / PM2 config) and Nginx
proxies to `127.0.0.1:8082`. Users keep using `:8081` exactly as before.

App env values become:

- `VITE_SUPABASE_URL = http://10.150.150.130:8081/supabase`
- `MIDDLEWARE_BASE_URL = http://10.150.150.130:8081/mw`

## What the config includes

- Upstreams for app (8082), Kong (8000), Studio (3000), middleware (3002) with
  keepalive.
- Plain HTTP listener on 8081 (and 8080 alias), `server_name 10.150.150.130`.
- 300s proxy/send/read timeouts on the app, Supabase and middleware paths so long
  SAP calls don't get cut, 50 MB body limit for storage uploads.
- Websocket upgrade handling for Supabase Realtime and Vite/HMR-style upgrades.
- HTTP basic auth on `/studio/` (`/etc/nginx/.htpasswd-studio`).
- Immutable caching for `/assets/`, no-cache for `sw.js` and the web manifest.
- Security headers (no HSTS, since this listener is plain HTTP).
- Header comment block with the exact install, `htpasswd`, `nginx -t` and reload
  commands, plus optional IP allow-list lines for `/mw/`.

## Deliverables

- `resl-approval-quality-nginx.conf` — ready to copy to
  `/etc/nginx/sites-available/` and symlink into `sites-enabled/`.
- A PDF of the same config for sharing with the infra team, visually checked page
  by page.

## Note

Without TLS, session tokens travel in clear text — acceptable on an internal
quality box, but add a certificate before anything user-facing.
