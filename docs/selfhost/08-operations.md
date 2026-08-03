# 08 — Operations

## Compose projects at a glance

| Environment | Stack | Folder | Compose project |
|---|---|---|---|
| Quality | Supabase | `Quality/supabase` | `resl_quality` |
| Quality | App | `Quality` | `resl_quality_app` |
| Quality | Middleware | `Quality` | `resl_quality_mw` |
| Production | Supabase | `Production/supabase` | `resl_production` |
| Production | App | `Production` | `resl_production_app` |
| Production | Middleware | `Production` | `resl_production_mw` |

## Start / stop / restart

```bash
R=/data/webapplication/resl_approval

# Start everything for Quality
cd $R/Quality/supabase && docker compose -p resl_quality up -d
cd $R/Quality && docker compose --env-file .env.app        -p resl_quality_app up -d
cd $R/Quality && docker compose --env-file .env.middleware -p resl_quality_mw  up -d

# Restart just the app
cd $R/Quality && docker compose -p resl_quality_app restart

# Stop an environment (data volumes are kept)
cd $R/Quality && docker compose -p resl_quality_app down
cd $R/Quality && docker compose -p resl_quality_mw  down
cd $R/Quality/supabase && docker compose -p resl_quality down
```

All compose files use `restart: unless-stopped`, so containers come back after a
reboot.

## Logs

```bash
docker compose -p resl_quality_app logs -f --tail=100 app
docker compose -p resl_quality_mw  logs -f --tail=100
docker compose -p resl_quality     logs -f --tail=100 db
docker compose -p resl_quality     logs -f --tail=100 auth
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

Docker rotates container logs at 10 MB × 3 files (step 02).

## Health checks

```bash
curl -sI http://127.0.0.1:3000/login   | head -1   # Quality app
curl -sI http://127.0.0.1:3010/login   | head -1   # Production app
curl -s  http://127.0.0.1:3005/__health            # Quality middleware
curl -s  http://127.0.0.1:3006/__health            # Production middleware
curl -s  http://127.0.0.1:8000/auth/v1/health      # Quality auth
docker ps --format 'table {{.Names}}\t{{.Status}}'
```

A simple cron watchdog:

```bash
crontab -e
*/5 * * * * curl -fsS http://127.0.0.1:3010/login >/dev/null || \
  logger -t resl "production app health check failed"
```

## Deployments

```bash
/data/webapplication/resl_approval/scripts/deploy.sh Quality
# verify in the browser, then
/data/webapplication/resl_approval/scripts/deploy.sh Production
```

Always ship to Quality first. The script exits non-zero if the health check
fails after restart, so it is safe to chain in CI.

Rolling back is a checkout plus a rebuild:

```bash
cd /data/webapplication/resl_approval/Production/app/src
git log --oneline -5
git checkout <previous-commit>
/data/webapplication/resl_approval/scripts/deploy.sh Production
```

## Backups

`scripts/backup.sh` dumps Postgres and archives the Supabase storage volume for
one environment into `/data/webapplication/resl_approval/backups/`, keeping 14
days.

```bash
scripts/backup.sh Production
ls -lh /data/webapplication/resl_approval/backups | tail
```

Install the nightly cron as `deploy`:

```bash
crontab -e
15 1 * * * /data/webapplication/resl_approval/scripts/backup.sh Production >> /data/webapplication/resl_approval/backups/backup.log 2>&1
45 1 * * * /data/webapplication/resl_approval/scripts/backup.sh Quality    >> /data/webapplication/resl_approval/backups/backup.log 2>&1
```

Copy backups off the server (another host, NAS, or object storage). A backup on
the same disk as the database is not a backup.

### Restore drill — do this once, on Quality

```bash
scripts/restore.sh Quality /data/webapplication/resl_approval/backups/resl-Quality-YYYYMMDD-HHMM.dump
```

Then re-run the verification queries from
[step 05](./05-migrate-data.md#5-verify-the-restore). Do not consider the
deployment finished until a restore has actually succeeded.

## Upgrades

**Supabase** (test on Quality first):

```bash
cd /data/webapplication/resl_approval/Quality/supabase
scripts/backup.sh Quality        # first
docker compose -p resl_quality pull
docker compose -p resl_quality up -d
docker compose -p resl_quality ps
```

**Host packages**:

```bash
sudo apt update && sudo apt -y upgrade && sudo reboot   # during a window
```

**Certificates**: Let's Encrypt renews via the certbot timer; run
`sudo certbot renew --dry-run` quarterly. Self-signed certs expire on the day you
set — put a reminder in the calendar.

## Key and secret rotation

| Secret | Rotation impact |
|---|---|
| `MIDDLEWARE_SHARED_SECRET` | update `.env.app`, `.env.middleware` and the UI field, restart both containers |
| `POSTGRES_PASSWORD` | change in Supabase `.env`, recreate the stack |
| `JWT_SECRET` | invalidates `ANON_KEY`, `SERVICE_ROLE_KEY` and every session — regenerate keys (step 04), update `.env.app`, rebuild the app, users sign in again |
| `DASHBOARD_PASSWORD` | Studio only |

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `502 Bad Gateway` | container down or wrong port | `docker ps`, check `proxy_pass` port |
| `504` (Nginx) / `524` (CDN) | gateway timeout below the SAP call | raise the hop; keep Nginx at 300s, avoid a proxying CDN on the middleware host |
| `Invalid JWT` / `JWSError` in the browser | `ANON_KEY` not signed with this stack's `JWT_SECRET`, or app built against the other environment | regenerate keys, rebuild the app |
| `permission denied for table …` | missing PostgREST grants | re-run the grant block in step 05 §4 |
| Rows load for admins only, or not at all | RLS policies missing after restore | compare `pg_policies` counts with the source |
| Login works, no SAP data | middleware or SAP config | `curl /__health`, then Test connection on the API row |
| Release Group/Code dropdowns empty | login response lacks `PR_KEYS`/`PO_KEYS` for the plant | re-login so keys refresh; check `Login_API` response |
| Auth e-mails not arriving | SMTP settings in Supabase `.env` | check `auth` container logs, verify relay credentials |
| Container restart loop | bad env value | `docker compose -p … logs <service>` |
| Disk full | Docker images, logs, backups | `docker system df`, prune images, prune old backups |
| Everything slow | Postgres memory / connection saturation | `docker stats`, `select count(*) from pg_stat_activity;`, raise resources |

## Monitoring suggestions

- `docker ps` / health-check cron as above
- Disk space alert at 80 % on `/data`
- Nginx 5xx rate from `/var/log/nginx/access.log`
- Postgres connection count and DB size, weekly

Back to the [index](./README.md).
