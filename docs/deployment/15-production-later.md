# 15 — Adding Production Later

The `Production/` folder tree already exists (guide 01) and is intentionally
empty. Nothing in it runs, so it costs nothing until you activate it.

---

## 1. Port and name allocation

Every port, PM2 name, and Docker project name differs from Quality, so the two
environments can never collide.

| Thing | Quality | Production |
|---|---|---|
| App (SSR) | 3000 | 4000 |
| SAP middleware | 3005 | 4005 |
| Supabase Kong | 8000 | 9000 |
| Supabase Studio | 3001 | 4001 |
| Postgres (loopback) | 5432 | 5433 |
| PM2 app process | `resl-quality-app` | `resl-prod-app` |
| PM2 middleware | `resl-quality-mw` | `resl-prod-mw` |
| Docker project | `resl_quality` | `resl_prod` |
| App hostname | `quality.example.com` | `app.example.com` |
| API hostname | `api-quality.example.com` | `api.example.com` |
| Middleware host | `mw-quality.example.com` | `mw.example.com` |
| Nginx site files | `resl-approval-quality*` | `resl-approval-prod*` |
| Log prefix | `resl-quality-*` | `resl-prod-*` |

## 2. Activation steps

Repeat guides 05–10 against `Production/`, substituting from the table above.

```bash
# Supabase
cd /data/webapplication/resl_approval/Production/supabase
# clone the stack, generate FRESH secrets (never reuse Quality's), set
# KONG_HTTP_PORT=9000 STUDIO_PORT=4001 POSTGRES_PORT_EXT=5433
docker compose -p resl_prod up -d

# Backend + frontend
# clone repo into Production/frontend/repo, PORT=4005 / 4000 in the env files
cd /data/webapplication/resl_approval/Production/scripts
pm2 start ecosystem.config.cjs           # defines resl-prod-app, resl-prod-mw
pm2 save

# Nginx
sudo ln -sfn /data/webapplication/resl_approval/nginx/resl-approval-prod.conf \
             /etc/nginx/sites-available/resl-approval-prod
sudo ln -sfn /etc/nginx/sites-available/resl-approval-prod \
             /etc/nginx/sites-enabled/resl-approval-prod
sudo nginx -t && sudo systemctl reload nginx
```

Copy `deploy/quality/` to `deploy/production/` and apply the substitutions once
— do not hand-edit files repeatedly.

## 3. Isolation rules

- **Separate Supabase stacks.** Two databases, two sets of JWT keys, two
  storage volumes. Never point Production at the Quality database.
- **Separate secrets.** Generate fresh `JWT_SECRET`, `ANON_KEY`,
  `SERVICE_ROLE_KEY`, `POSTGRES_PASSWORD`, `MIDDLEWARE_SHARED_SECRET`,
  and VAPID keys. A leaked Quality key must not touch Production.
- **Separate SAP endpoints.** Point Production at the SAP production client in
  Admin → SAP API Settings; Quality stays on the SAP quality client.
- **Separate Docker project names** (`-p resl_prod`) so `docker compose down`
  in one directory can never stop the other stack.
- **Separate backups** — `Production/backups/`, own schedule, off-box copies.

## 4. Promotion workflow

```text
git tag v1.5.0            (after Quality sign-off)
        │
        ├─ Quality:    ./deploy.sh v1.5.0   → test, sign off
        │
        └─ Production: ./deploy.sh v1.5.0   → same tag, same artifact recipe
```

Rules:
1. Production deploys **tags only** — never `main`.
2. Deploy the exact tag that passed Quality; do not rebuild from a moving
   branch.
3. Apply database migrations to Production in the same order they were applied
   to Quality, after a fresh backup.
4. Deploy in a maintenance window; announce it.
5. Keep the previous release directory available — `rollback.sh` is the first
   response to any problem.

## 5. Resource planning

Running both environments on one server roughly doubles the footprint:

| Resource | Quality only | Quality + Production |
|---|---|---|
| RAM | 8 GB | 16 GB recommended |
| vCPU | 4 | 8 |
| Disk `/data` | 100 GB | 250 GB |

Watch for build-time contention: a Production build while Quality is under load
can exhaust CPU and RAM. Build during a quiet period, or build elsewhere and
ship `dist/`.

## 6. Verification

```bash
pm2 status                                     # 4 processes, all online
docker compose -p resl_quality ps
docker compose -p resl_prod ps
ss -ltnp | grep -E ':3000|:3005|:4000|:4005|:8000|:9000'
curl -sI https://app.yourdomain.com/login | head -1
```

Confirm the two are truly independent: stop Quality
(`pm2 stop resl-quality-app`) and check Production still serves.

Back to [README](./README.md)
