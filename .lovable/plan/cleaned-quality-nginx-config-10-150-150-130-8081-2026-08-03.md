# Cleaned Quality Nginx Config (10.150.150.130:8081)

Trim the pasted config down to only what this deployment actually needs, and deliver it as a ready-to-copy file.

## What stays
- `map $http_upgrade $connection_upgrade` (needed for websockets on Supabase realtime and the app)
- Upstreams for frontend (8082), Supabase Kong (8000), Studio (3000), middleware (3002)
- Single server block on 8081 with `server_name 10.150.150.130`
- `client_max_body_size 50M`, 300s timeouts on the long-running SAP/middleware paths
- Access/error logs
- `/supabase/`, `/studio/` (basic auth), `/mw/`, and `/` proxy blocks
- Gzip

## What gets removed or corrected
- Port 8080 alias listeners — dropped (unused, and doubling listeners on the same server_name only adds confusion)
- `/assets/` block — remove. Adding `expires`/`Cache-Control` here fights the hashed-asset headers the app already sends, and `/` already proxies these to the same upstream
- PWA regex block (`sw.js`, `manifest.webmanifest`) — remove unless a service worker is actually shipped; `/` handles them
- Security headers reduced to the three that matter for an internal IP deployment (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`); `Permissions-Policy` dropped
- `proxy_intercept_errors off` — already the default, removed
- `client_body_buffer_size`, `client_body_timeout` — trimmed to defaults except where needed
- `Upgrade`/`Connection $connection_upgrade` removed from `/mw/` (it is plain JSON HTTP; keeps `Connection ""` for keepalive)
- `gzip_types` shortened to the types actually served
- `server_tokens off` kept (one line, real benefit)

## Deliverables
- Cleaned config file at `/mnt/documents/resl-approval-quality-nginx.conf` (overwrites the previous version)
- Regenerated PDF `/mnt/documents/nginx-quality-10.150.150.130-8081.pdf` with the cleaned config plus the short env-var note (`PORT=8082`, `VITE_SUPABASE_URL=http://10.150.150.130:8081/supabase`, `MIDDLEWARE_BASE_URL=http://10.150.150.130:8081/mw`)
- Also pasted inline in chat so you can copy it directly

No application source changes.
