# RESL Approval — Ubuntu 24.04 Deployment Handbook (Quality)

Internal installation and deployment document for the RESL Approval
application on a single Ubuntu 24.04 LTS server.

**Scope of this revision:** the **Quality** environment is configured
end-to-end. The **Production** folder tree is created but intentionally left
empty and unconfigured — see [15-production-later.md](./15-production-later.md).

---

## 1. Audience and prerequisites

You need:

- Ubuntu 24.04 LTS server, root or `sudo` access
- 4 vCPU / 8 GB RAM / 100 GB on `/data` (minimum for app + Supabase)
- DNS names (or internal DNS) pointing at the server
- Outbound HTTPS from the server (Docker Hub, apt, GitHub)
- Network reachability from the server to the SAP gateway
- The Git repository URL for this application

Placeholders used throughout — replace with your own:

| Placeholder | Meaning |
|---|---|
| `quality.example.com` | Quality app (frontend + API) |
| `api-quality.example.com` | Quality Supabase API (Kong) |
| `mw-quality.example.com` | Quality SAP middleware |
| `deploy` | Unprivileged service account |

---

## 2. What this application actually is

Read this before mapping the folder structure onto services.

The frontend is **not** a static `dist/` folder served by Nginx. It is a
**TanStack Start SSR application**: a single build output that serves the HTML
*and* the application's own server-side API (`createServerFn` handlers and
`/api/*` routes) from **one** process. There is therefore no separate
"React build directory" and no CORS between the frontend and its own API.

The separate Node.js backend you do have is the **SAP middleware**
(`middleware/server.js`) — a small Express service that proxies SAP calls,
holds the SAP credentials and enforces the shared secret.

| Your folder | What lives there | Process | Port |
|---|---|---|---|
| `Quality/frontend` | App source + build output (SSR server & assets) | PM2 → `wrangler` | `3000` |
| `Quality/backend` | SAP middleware (Express) | PM2 → `node server.js` | `3005` |
| `Quality/supabase` | Self-hosted Supabase Docker stack | Docker Compose | `8000` / `3001` / `5432` |
| `Quality/logs` | PM2 + application logs | — | — |
| `Quality/scripts` | deploy / backup / restore / rollback | — | — |
| `Quality/backups` | Nightly Postgres dumps | — | — |
| `Quality/ssl` | TLS certs when not using Let's Encrypt | — | — |
| `nginx` | Nginx server blocks (symlinked into `/etc/nginx`) | Nginx | `80` / `443` |

Everything except Nginx binds to `127.0.0.1`. Nginx is the only public
listener.

---

## 3. Directory structure

```text
/data
└── webapplication
    └── resl_approval
        ├── Quality
        │   ├── frontend        # git checkout + build output
        │   ├── backend         # SAP middleware
        │   ├── supabase        # supabase/docker stack + .env + volumes
        │   ├── logs            # app-*.log, middleware-*.log
        │   ├── scripts         # deploy.sh, backup.sh, restore.sh, rollback.sh
        │   ├── backups         # resl-quality-YYYYmmdd-HHMM.sql.gz
        │   └── ssl             # resl-quality.crt / .key (optional)
        │
        ├── Production          # same subfolders, created empty, NOT configured
        │   ├── frontend
        │   ├── backend
        │   ├── supabase
        │   ├── logs
        │   ├── scripts
        │   ├── backups
        │   └── ssl
        │
        └── nginx               # *.conf server blocks, symlinked to /etc/nginx
```

---

## 4. Order of operations (day one)

Work through the guides in order. Each one ends with a verification step;
do not continue until it passes.

| # | Guide | Outcome |
|---|---|---|
| 01 | [Ubuntu server preparation](./01-server-prep.md) | Users, folders, permissions, firewall, SSH, tuning |
| 02 | [Node.js installation](./02-nodejs.md) | Node LTS + npm + Bun |
| 03 | [PM2 installation](./03-pm2.md) | Process manager + boot service |
| 04 | [Docker installation](./04-docker.md) | Engine + Compose v2 |
| 05 | [Self-hosted Supabase](./05-supabase.md) | Database, Auth, Storage, Studio, Kong running |
| 06 | [Database setup](./06-database-setup.md) | Application schema + data loaded |
| 07 | [Backend deployment](./07-backend-deploy.md) | SAP middleware live on `:3005` |
| 08 | [Frontend deployment](./08-frontend-deploy.md) | App live on `:3000` |
| 09 | [Nginx installation](./09-nginx-install.md) | Web server running |
| 10 | [Nginx Quality configuration](./10-nginx-quality-config.md) | Public HTTPS endpoints |
| 11 | [Environment variables](./11-env-variables.md) | All `.env` files, secured |
| 12 | [Deployment process](./12-deployment-process.md) | Repeatable deploy + rollback |
| 13 | [Monitoring](./13-monitoring.md) | Logs, health checks, rotation |
| 14 | [Troubleshooting](./14-troubleshooting.md) | Failure triage |
| 15 | [Production preparation](./15-production-later.md) | What changes later |

Ready-to-copy configuration files and scripts referenced by these guides live
in the repository at `deploy/quality/`.

---

## 5. Port map (Quality)

| Service | Bind | Port | Public via |
|---|---|---|---|
| App (SSR + API) | `127.0.0.1` | 3000 | `quality.example.com` |
| SAP middleware | `127.0.0.1` | 3005 | `mw-quality.example.com` |
| Supabase Kong (API) | `127.0.0.1` | 8000 | `api-quality.example.com` |
| Supabase Studio | `127.0.0.1` | 3001 | `api-quality.example.com/studio` (basic auth) |
| Postgres | `127.0.0.1` | 5432 | not public |

Production will use a second, non-overlapping set — see guide 15.

---

## 6. Timeout rule (read once, remember always)

Some SAP reports legitimately run for minutes. **Every hop must allow more
time than the middleware's `SAP_REQUEST_TIMEOUT_MS`**, which this handbook
sets to `300000` (5 min):

| Hop | Setting | Value |
|---|---|---|
| Nginx | `proxy_read_timeout` / `proxy_send_timeout` / `send_timeout` | `300s` |
| Middleware | `SAP_REQUEST_TIMEOUT_MS` | `300000` |
| Any CDN in front | must not cap below that | keep middleware DNS-only |

A `504` from Nginx is a **gateway** timeout, not a SAP error. Raise the
lowest hop.
