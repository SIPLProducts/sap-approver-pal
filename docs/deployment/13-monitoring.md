# 13 — Monitoring & Maintenance

## 1. PM2

```bash
pm2 status                          # state, CPU, memory, restarts, uptime
pm2 monit                           # live dashboard
pm2 describe resl-quality-app       # full config incl. env
pm2 logs --lines 100                # both processes
pm2 logs resl-quality-mw --err      # errors only
pm2 flush                           # truncate logs
```

Warning signs: `restarts` climbing, `status` flipping to `errored`, memory
approaching the 1 GB / 512 MB `max_memory_restart` limits.

## 2. Logs

| Source | Location |
|---|---|
| App SSR | `Quality/logs/app-{out,err}.log` |
| SAP middleware | `Quality/logs/middleware-{out,err}.log` |
| Nginx (per site) | `/var/log/nginx/resl-quality-{app,api,mw}.{access,error}.log` |
| Supabase | `docker compose -p resl_quality logs <service>` |
| System | `journalctl -u nginx`, `journalctl -u docker` |
| SAP call audit | in-app admin sync-log screen |

```bash
# Slowest requests in the last 10k lines (needs $request_time in log_format)
sudo tail -10000 /var/log/nginx/resl-quality-app.access.log | awk '{print $NF, $7}' | sort -rn | head

# 5xx count today
sudo grep " 5[0-9][0-9] " /var/log/nginx/resl-quality-app.access.log | wc -l
```

Rotation: `pm2-logrotate` (20 MB, 14 files, gzip) for PM2;
`/etc/logrotate.d/nginx` (daily, 14 days) for Nginx; Docker daemon capped at
10 MB × 3 per container (guide 04).

## 3. Disk

```bash
df -h /data /
du -sh /data/webapplication/resl_approval/Quality/* | sort -h
du -sh /data/docker
docker system df
```

Reclaim space:

```bash
docker image prune -af           # unused images
docker builder prune -af         # build cache
pm2 flush
sudo journalctl --vacuum-time=14d
# keep only 5 releases
ls -1dt /data/webapplication/resl_approval/Quality/frontend/releases/* | tail -n +6 | xargs -r rm -rf
```

Never prune volumes.

## 4. Health monitoring

```bash
curl -s http://127.0.0.1:3000/login -o /dev/null -w '%{http_code} %{time_total}\n'
curl -s http://127.0.0.1:3005/__health
curl -s -o /dev/null -w '%{http_code}\n' -H "apikey: $ANON" http://127.0.0.1:8000/rest/v1/
```

A minimal cron watchdog (`crontab -e` as `deploy`):

```cron
*/5 * * * * curl -fsS --max-time 20 http://127.0.0.1:3000/login >/dev/null || pm2 restart resl-quality-app
*/5 * * * * curl -fsS --max-time 20 http://127.0.0.1:3005/__health >/dev/null || pm2 restart resl-quality-mw
```

## 5. Backups

```bash
./scripts/backup.sh              # full: db + storage + env + nginx
./scripts/backup.sh --quick      # database only
```

Schedule (as `deploy`):

```cron
15 2 * * *  /data/webapplication/resl_approval/Quality/scripts/backup.sh >> /data/webapplication/resl_approval/Quality/logs/backup.log 2>&1
```

Retention: 14 daily archives locally. Copy off-box weekly — a backup on the
same disk is not a backup. Test a restore into a scratch database quarterly.

## 6. Updates

| Item | Cadence | Command |
|---|---|---|
| OS security patches | monthly | `sudo apt update && sudo apt upgrade` |
| Node.js 22.x patch | quarterly | `sudo apt install --only-upgrade nodejs`, then rebuild + `pm2 update` |
| PM2 | quarterly | `sudo npm i -g pm2 && pm2 update` |
| Supabase images | quarterly | `docker compose -p resl_quality pull && up -d` (backup first) |
| Nginx | with OS patches | `sudo apt upgrade nginx` |
| App dependencies | per release | `bun update` in a branch, test, then deploy |

Reboot after a kernel update: `pm2 resurrect` runs automatically via the
systemd unit; Docker containers restart via `restart: unless-stopped`.
Always verify with `pm2 status` and `docker compose -p resl_quality ps`.

## 7. Performance baseline

Record these when the system is healthy so deviations are visible:

```bash
uptime                                  # load average
free -h                                 # memory + swap use
pm2 status                              # per-process RSS
curl -s -o /dev/null -w '%{time_total}\n' http://127.0.0.1:3000/login
docker compose -p resl_quality exec db psql -U postgres -c \
  "select count(*) from pg_stat_activity;"
```

Slow-query review:

```sql
SELECT calls, round(mean_exec_time) ms, left(query, 90)
FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;
```

Next: [14 — Troubleshooting](./14-troubleshooting.md)
