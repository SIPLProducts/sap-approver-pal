## Goal

Produce a complete, self-contained documentation set (plus the config files, env templates and scripts it references) for running this application entirely on your own Ubuntu server under `/data`, with self-hosted Supabase — Quality and Production side by side. No application code behavior changes; this is deployment documentation and infrastructure files only.

## Target folder layout on the server

```text
/data/webapplication/resl_approval/
├── Quality/
│   ├── app/                 # frontend + server build (docker compose)
│   ├── middleware/          # SAP middleware container
│   ├── supabase/            # self-hosted Supabase stack (docker compose + volumes)
│   ├── .env.app
│   ├── .env.middleware
│   ├── .env.supabase
│   └── docker-compose.yml
├── Production/              # same structure, separate ports/volumes/secrets
├── nginx/
│   ├── quality-app.conf
│   ├── quality-supabase.conf
│   ├── production-app.conf
│   ├── production-supabase.conf
│   └── middleware-*.conf
└── scripts/
    ├── bootstrap-server.sh  # docker + nginx + firewall + folders
    ├── deploy.sh            # git pull, build, compose up, health check
    ├── backup.sh            # pg_dump + storage volume backup
    └── restore.sh
```

Port map to be documented (Quality / Production): app `3000 / 3010`, middleware `3005 / 3006`, Supabase Kong `8000 / 8010`, Postgres `5432 / 5433`, Studio behind Nginx basic-auth.

## Documents to be written

1. **`docs/selfhost/00-overview.md`** — architecture diagram, what runs where, port/volume matrix, Quality vs Production differences, prerequisites (Ubuntu 22.04/24.04, 4 vCPU / 8 GB / 100 GB min, DNS or internal hostnames, SAP network reachability).
2. **`docs/selfhost/01-server-prep.md`** — OS updates, timezone, non-root deploy user, `/data` folder creation with ownership/permissions, UFW rules (22/80/443 only), fail2ban, log rotation, swap.
3. **`docs/selfhost/02-docker.md`** — Docker Engine + Compose v2 install from Docker's apt repo, daemon config (log rotation, data-root on `/data` if desired), post-install verification.
4. **`docs/selfhost/03-nginx-ssl.md`** — Nginx install, site layout, Let's Encrypt via certbot **and** the internal-CA / self-signed alternative for an intranet server, HTTP→HTTPS redirect, the 300s proxy timeouts that long SAP reports need, WebSocket/realtime upgrade headers, `client_max_body_size`.
5. **`docs/selfhost/04-supabase-selfhost.md`** — clone `supabase/docker`, generate `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `DASHBOARD_*`; set `SITE_URL` / `API_EXTERNAL_URL` / `SUPABASE_PUBLIC_URL`; SMTP for auth emails; disable public signups; bring the stack up; verify Postgres, Auth, Storage, Studio. Separate compose project names and volumes for Quality vs Production.
6. **`docs/selfhost/05-migrate-data.md`** — moving the current Lovable Cloud backend to the self-hosted one: schema + data dump order (`roles`, `schema`, `data`), `auth.users` and identities migration, storage objects, then re-applying grants/RLS. Includes verification queries (row counts per table, one login test) and a rollback note.
7. **`docs/selfhost/06-app-deploy.md`** — building and running the frontend/server on your own host. This is the one real technical change to call out: the app currently builds for the Cloudflare Workers target (`wrangler.jsonc`, `@cloudflare/vite-plugin`). The doc will cover the Node-server build path, its `Dockerfile`, the required env (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_*`, `MIDDLEWARE_SHARED_SECRET`, mail + web-push keys), and per-environment `.env.app` templates. Any Workers-specific adjustment needed for a Node/Docker build is documented as an explicit, clearly-marked step rather than applied silently.
8. **`docs/selfhost/07-middleware.md`** — the SAP middleware re-pathed to `/data`, `.env.middleware` for both environments, `APP_BASE_URL` now pointing at your own hostnames instead of `*.lovable.app`, Nginx block, and the "Via Proxy" wiring in **Admin → SAP API Settings**.
9. **`docs/selfhost/08-operations.md`** — start/stop/restart, log locations and `docker compose logs` recipes, backups (nightly `pg_dump` + storage volume tar, retention, restore drill), upgrades, health checks, and a troubleshooting table (524/504 timeouts, auth-gate errors, invalid JWT, SAP unreachable, container restart loops, disk full).
10. **`docs/selfhost/README.md`** — index with a "do these in order" checklist and a final go-live verification list.

## Files to be created alongside the docs

- `deploy/data/Quality/*` and `deploy/data/Production/*` — `docker-compose.yml`, `.env.*.example` for app, middleware and Supabase (placeholders only, no real secrets).
- `deploy/data/nginx/*.conf` — the six server blocks referenced above, with `example.com` placeholders and the 300s timeouts.
- `deploy/data/scripts/bootstrap-server.sh`, `deploy.sh`, `backup.sh`, `restore.sh` — idempotent, `set -euo pipefail`, echo each step.
- `deploy/Dockerfile.app` — multi-stage Node build for the frontend/server container.

Existing `DEPLOYMENT.md` gets a short pointer to the new `docs/selfhost/` set; it is not deleted.

## Notes and honest caveats

- Self-hosted Supabase means you own upgrades, backups, and JWT/key rotation. The docs will state this plainly and include the backup drill.
- Lovable Cloud's service-role key and database password are not retrievable, so the migration document uses a fresh key set generated on your server, plus a schema/data export path — I'll flag exactly which export step you must run from your side.
- Nothing in the running app is modified by this work; the Lovable-hosted version keeps working while you build the self-hosted one.
