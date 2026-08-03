# Nginx config for the quality server at 10.150.150.130

Rewrite the existing single-host quality config so it works on the IP address directly (no domain name, no TLS certificate), keeping the port mapping you gave.

## Routing

```text
http://10.150.150.130/            -> frontend app (SSR + its own /api/*) : 8081
http://10.150.150.130/supabase/   -> Supabase API gateway (Kong)         : 8000
http://10.150.150.130/studio/     -> Supabase Studio (basic auth)        : 3000
http://10.150.150.130/mw/         -> SAP middleware                      : 3002
```

Nginx listens on both port 80 and port 8080 with the same routing, so either
`http://10.150.150.130/` or `http://10.150.150.130:8080/` works. Nothing runs on
8080 itself, so there is no conflict.

The app process stays bound to 8081, so `http://10.150.150.130:8081/` keeps
working directly (bypassing Nginx) exactly as it does today.


## What changes

- Update `deploy/quality/nginx/resl-approval-quality-single-host.conf`:
  - `server_name 10.150.150.130;`, plain HTTP only — drop the HTTPS block, the
    HTTP-to-HTTPS redirect and all TLS/HSTS lines.
  - `listen 80;` plus `listen 8080;` in the same server block.
  - Keep upstreams on 127.0.0.1 for 8081 / 8000 / 3000 / 3002, keep the 300s
    timeouts, 50 MB body limit, Realtime websocket upgrade handling, asset and
    PWA cache rules, and basic auth on `/studio/`.
- Update the "single-host" section of `docs/deployment/10-nginx-quality-config.md`
  with the IP-based values and the env settings the app needs:
  - `VITE_SUPABASE_URL = http://10.150.150.130/supabase`
  - middleware base URL `= http://10.150.150.130/mw`
- Regenerate the PDF of just this config file so you have a downloadable copy.

## Note

Without TLS, session tokens travel in clear text. Fine for an internal quality
box on a private network; add a certificate before anything user-facing.
