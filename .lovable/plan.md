# One Nginx config, delivered as a PDF

You only need a single file. The config already written at
`deploy/quality/nginx/resl-approval-quality-single-host.conf` is that file — one
server block covering everything on one hostname:

| Path | Upstream port |
|---|---|
| `/` (app + its own `/api/*`) | 8081 |
| `/supabase/` | 8000 |
| `/studio/` (basic auth) | 3000 |
| `/mw/` (SAP middleware) | 3002 |

## What I'll do

1. Keep that one config file as the single source of truth. No other new deploy
   files, no extra docs sections.
2. Generate a PDF containing the complete config, verbatim and copy-pasteable:
   - Cover line with hostname/port table
   - The full config listing with line numbers, monospaced, syntax-shaded
   - Short install/verify block at the end (symlink, `nginx -t`, reload,
     `htpasswd` for `/studio`, and the two env values:
     `VITE_SUPABASE_URL=https://<host>/supabase`, middleware base
     `https://<host>/mw`)
3. Save to `/mnt/documents/nginx-quality-single-host.pdf` and visually QA every
   page (no clipped lines, config wraps rather than truncates).

## Optional cleanup

If you'd like, I can also delete the now-redundant multi-host Quality Nginx
configs (`resl-approval-quality.conf`, `-supabase.conf`, `-middleware.conf`) so
only the single-host file remains. Say the word and I'll include that.

## Technical notes

PDF is generated with a Python/ReportLab script under `/tmp` (not added to the
repo). Config content is emitted exactly as in the `.conf` file, with soft
wrapping at a visible continuation marker so long `proxy_*` lines stay accurate.
