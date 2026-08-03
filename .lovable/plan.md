## Goal

A complete Quality-only setup and deployment handbook for Ubuntu 24.04 under `/data/webapplication/resl_approval`, matching your folder structure, with the Production tree created but left unconfigured.

## One important correction

This app is **not** a static React `dist` plus a separate Node API. It is a TanStack Start SSR app: a single build output that serves the HTML *and* the server functions (your "backend API") from one process. The separate Node backend you do have is the **SAP middleware** (`middleware/server.js`, port 3005).

So your structure maps onto reality like this:

```
Quality/
├── frontend/   # app source + build output (SSR, PM2 on :3000)
├── backend/    # SAP middleware (Node, PM2 on :3005)
├── supabase/   # self-hosted Supabase docker stack
├── logs/       # PM2 + app logs
├── scripts/    # deploy / backup / restore / rollback
├── backups/    # nightly pg dumps
└── ssl/        # certs if not using Let's Encrypt
```

Nginx reverse-proxies: `/` → :3000 (frontend + its API, same origin), `api-quality` host → :8000 (Supabase Kong), `mw-quality` host → :3005 (middleware). No CORS needed between the frontend and its own API — CORS is documented only for the Supabase and middleware hosts.

Because you want PM2, the guide documents switching the build target to the Node server preset so PM2 supervises a plain `node server.js` (recommended), with the `wrangler dev --local` alternative noted. I'll flag that as a decision point and won't change build config unless you approve it.

## Deliverable — `docs/deployment/`

| File | Contents |
|---|---|
| `README.md` | Cover page, prerequisites, day-one order of operations, full directory tree |
| `01-server-prep.md` | apt update/upgrade, base packages, `deploy` user + sudo, full `mkdir -p` for Quality **and** empty Production, ownership/permission matrix, UFW (22/80/443), SSH hardening, swap + sysctl/limits tuning |
| `02-nodejs.md` | NodeSource LTS install, version verification, npm, optional nvm, Bun (this repo's lockfile) |
| `03-pm2.md` | install, `ecosystem.config.cjs` for both processes, start/reload/restart/stop, `pm2 logs`, logrotate module, `pm2 save`, `pm2 startup` systemd unit, zero-downtime reload |
| `04-docker.md` | keyring + apt repo, compose v2, `daemon.json` (log caps, `/data/docker`), docker group, `hello-world` verification |
| `05-supabase.md` | clone `supabase/docker`, full `.env` walkthrough (Postgres password, JWT secret, anon/service-role key minting, vault/logflare keys, dashboard creds, SITE_URL/API_EXTERNAL_URL, signup disabled, SMTP), per-service notes (db, kong, auth, rest, realtime, storage, functions, studio), volumes, port map, up/down/health, resulting folder tree |
| `06-database-setup.md` | dump the current cloud schema + data, restore order into self-hosted Postgres, `GRANT`/role repair, verifying RLS and the `has_role`/`is_admin` functions |
| `07-backend-deploy.md` | middleware into `Quality/backend`, `npm ci --omit=dev`, `.env` (shared secret, SAP URLs, 300 s timeouts), PM2 entry, log paths, restart policy, `/__health` check |
| `08-frontend-deploy.md` | clone into `Quality/frontend`, `bun install`, build with `VITE_*` baked in, output layout, PM2 entry on :3000, asset caching, rebuild-on-env-change warning |
| `09-nginx-install.md` | install, enable/start/reload/restart, config locations, log paths, `nginx -t` habit |
| `10-nginx-quality-config.md` | complete annotated configs at `/etc/nginx/sites-available/resl-approval-quality`, `…-quality-supabase`, `…-quality-middleware`, symlinked into `sites-enabled/`, plus shared `conf.d/00-upgrade-map.conf` and `conf.d/gzip.conf`. Every directive explained: proxy headers, WebSocket upgrade, gzip, `client_max_body_size 50m`, static caching, security headers, 300 s timeouts and why, CORS for the Supabase/middleware hosts, SSL placeholders for both Let's Encrypt and `Quality/ssl/` self-signed |
| `11-env-variables.md` | annotated sample `.env` files (frontend build-time + runtime, backend/middleware, Supabase stack), which are secret, which need a rebuild, `chmod 600` |
| `12-deployment-process.md` | pre-deployment checklist → deploy → post-deployment → validation → rollback, with a `deploy.sh` that keeps the previous release for rollback |
| `13-monitoring.md` | `pm2 monit`/`status`, logrotate, docker log caps, Nginx log review, disk/health cron, uptime check on `/__health` |
| `14-troubleshooting.md` | 502 vs 504 vs SAP timeout triage, PM2 crash loops, Supabase container failures, JWT/anon-key mismatch, RLS permission errors, wrong `VITE_*` baked into the bundle, certificate errors |
| `15-production-later.md` | Production tree created but idle: exactly what changes when you enable it (ports 5433/8001/3002/3006, own `.env` + JWT secret, own certs/hostnames, stricter backups) and the activation checklist |

## Supporting files — `deploy/quality/`

`ecosystem.config.cjs`, `.env.frontend.example`, `.env.backend.example`, `.env.supabase.example`, `nginx/` (three annotated server blocks + shared conf.d snippets), and `scripts/bootstrap-server.sh`, `deploy.sh`, `backup.sh`, `restore.sh`, `rollback.sh`. Production directories are created empty, with no Production config.

Hostnames use `quality.example.com`, `api-quality.example.com`, `mw-quality.example.com` placeholders with a one-line `sed` to swap in yours.

## Technical notes

- Quality ports: app 3000, middleware 3005, Kong 8000, Studio 3001, Postgres 5432 — all bound to `127.0.0.1`; only Nginx is public.
- Every hop's timeout ≥ the middleware's `SAP_REQUEST_TIMEOUT_MS` (300000) so long SAP reports don't 504.
- `VITE_*` are compile-time: changing them needs a rebuild, not a PM2 restart.
- No application source changes, apart from the optional documented Vite server-preset switch needed for PM2 to run plain Node.
- Existing `docs/selfhost/` is left in place; this is a separate, PM2-based handbook.