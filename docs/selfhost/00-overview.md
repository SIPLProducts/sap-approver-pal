# 00 — Overview & Architecture

## What you are deploying

Four moving parts, twice (Quality and Production):

| Component | Purpose | Runtime |
|---|---|---|
| **App** | React frontend + TanStack Start server functions (SSR) | Docker container |
| **Supabase** | Postgres, Auth (GoTrue), Storage, REST (PostgREST), Realtime, Studio | Docker Compose stack |
| **SAP middleware** | Bridge from the app to the on-premise SAP system | Docker container |
| **Nginx** | TLS termination and reverse proxy for all of the above | Host service |

## Topology

```text
                       Browser (intranet / VPN)
                                 │ HTTPS
                                 ▼
┌───────────────────────────────────────────────────────────────────────┐
│  Ubuntu server                                                        │
│                                                                       │
│   Nginx (443)                                                         │
│    ├── quality.example.com        ──► app-quality        :3000        │
│    ├── api-quality.example.com    ──► supabase kong Q    :8000        │
│    ├── mw-quality.example.com     ──► middleware-quality :3005        │
│    ├── app.example.com            ──► app-prod           :3010        │
│    ├── api.example.com            ──► supabase kong P    :8010        │
│    └── mw.example.com             ──► middleware-prod    :3006        │
│                                                                       │
│   Docker                                                              │
│    ├── /data/.../Quality/supabase      (compose project resl_q)      │
│    ├── /data/.../Quality/app                                          │
│    ├── /data/.../Quality/middleware                                   │
│    ├── /data/.../Production/supabase   (compose project resl_p)      │
│    ├── /data/.../Production/app                                       │
│    └── /data/.../Production/middleware                                │
│                                                                       │
└──────────────────────────────┬────────────────────────────────────────┘
                               │ LAN / VPN
                               ▼
                       On-premise SAP system
```

## Folder layout on the server

```text
/data/webapplication/resl_approval/
├── Quality/
│   ├── app/                 # checkout + app docker-compose
│   ├── middleware/          # middleware docker-compose
│   ├── supabase/            # supabase/docker checkout + volumes
│   ├── .env.app
│   ├── .env.middleware
│   └── .env.supabase
├── Production/              # same shape, separate ports/volumes/secrets
├── nginx/                   # server blocks, symlinked into /etc/nginx
├── scripts/                 # bootstrap, deploy, backup, restore
└── backups/                 # nightly dumps (created by backup.sh)
```

## Port map

| Service | Quality | Production | Exposed publicly? |
|---|---|---|---|
| App (SSR server) | 3000 | 3010 | via Nginx only |
| SAP middleware | 3005 | 3006 | via Nginx only |
| Supabase Kong (API gateway) | 8000 | 8010 | via Nginx only |
| Supabase Studio | 3001 | 3011 | via Nginx + basic auth |
| Postgres | 5432 | 5433 | **no** — bind to 127.0.0.1 |
| Analytics (logflare) | 4000 | 4010 | no |

Only `22`, `80` and `443` are open on the firewall. Everything else is reached
through Nginx or from the host itself.

## Quality vs Production differences

| Concern | Rule |
|---|---|
| Compose project name | `resl_quality` vs `resl_production` (keeps volumes apart) |
| Docker volumes | prefixed by the project name — never shared |
| Secrets | **different** JWT secret, DB password, dashboard password, middleware shared secret |
| Hostnames | separate DNS names and certificates |
| Data | Quality may hold a copy of production data; treat it as equally confidential |

## Prerequisites

**Server**

- Ubuntu 22.04 LTS or 24.04 LTS, x86_64
- Minimum for both environments on one host: 4 vCPU, 8 GB RAM, 100 GB SSD on `/data`
  (comfortable: 8 vCPU, 16 GB RAM, 250 GB)
- Root or `sudo` access
- Outbound HTTPS (to pull Docker images and, if used, Let's Encrypt)
- Network route to the SAP host and to your SMTP relay

**Names and certificates**

- Six DNS records (or fewer if you skip Studio/API hostnames) pointing at the server
- Public certificates via Let's Encrypt, **or** an internal CA / self-signed pair
  if the server is intranet-only (covered in step 03)

**Credentials you must have on hand**

- SAP endpoint URLs and service user credentials (entered in the app UI, not env files)
- SMTP host, port, user, password for auth e-mails
- A source dump of the current backend (step 05)

## Time estimate

| Step | Rough effort |
|---|---|
| 01–03 (server, Docker, Nginx) | 1–2 h |
| 04 (Supabase × 2) | 1–2 h |
| 05 (migration + verification) | 2–4 h |
| 06–07 (app + middleware × 2) | 2–3 h |
| 08 (backups, drill) | 1 h |

Next: [01 — Server preparation](./01-server-prep.md)
