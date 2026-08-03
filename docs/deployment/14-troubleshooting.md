# 14 — Troubleshooting

Work top-down: Nginx → PM2 process → Supabase → SAP.

```bash
sudo nginx -t && systemctl is-active nginx
pm2 status
docker compose -p resl_quality -f /data/webapplication/resl_approval/Quality/supabase/docker-compose.yml ps
ss -ltnp | grep -E ':3000|:3005|:8000|:3001'
```

---

## 502 Bad Gateway

Nginx reached nothing on the upstream port.

```bash
pm2 status                                     # is the process online?
ss -ltnp | grep 3000                           # is anything listening?
pm2 logs resl-quality-app --err --lines 80     # why it died
sudo tail -30 /var/log/nginx/resl-quality-app.error.log
```

Causes and fixes:
- process crashed on boot → read the stderr log; usually a missing env var
- wrong port in the upstream block → align Nginx with `PORT`
- app bound to a container-only interface → confirm `127.0.0.1:3000`
- SELinux/AppArmor is not the cause on stock Ubuntu; do not chase it

`pm2 restart resl-quality-app --update-env` after fixing env issues.

## 504 Gateway Timeout

The upstream was reached but did not answer in time. Almost always a large SAP
report.

Timeouts must be ordered: **SAP endpoint ≤ `SAP_REQUEST_TIMEOUT_MS` (300000) ≤
Nginx `proxy_read_timeout` (300s)**. If Nginx is shorter, you get 504 while the
middleware is still working.

```bash
grep proxy_read_timeout /data/webapplication/resl_approval/nginx/*.conf
grep SAP_REQUEST_TIMEOUT_MS /data/webapplication/resl_approval/Quality/backend/.env
```

Also reduce the payload: the BMW Status Report already fetches in date chunks
and the SD Dashboard aggregates server-side. If a new screen times out, chunk
it the same way rather than raising timeouts further.

## Blank page / assets 404

```bash
ls /data/webapplication/resl_approval/Quality/frontend/current/dist/client
curl -sI https://quality.yourdomain.com/assets/<file>.js | head -1
```

- `current` symlink points at a release with no `dist/` → re-run `deploy.sh`
- browser cached an old `index` referencing removed hashed files → hard reload;
  the `no-cache` header on `sw.js` prevents this recurring
- service worker serving a stale shell → DevTools → Application → Unregister

## Login fails / "Invalid API key" / JWSError

`JWT_SECRET`, `ANON_KEY`, and `SERVICE_ROLE_KEY` are out of sync, or the app
was built against a different Supabase URL.

```bash
grep -E '^(JWT_SECRET|ANON_KEY|SERVICE_ROLE_KEY)=' Quality/supabase/.env
grep VITE_SUPABASE Quality/frontend/.env.build
docker compose -p resl_quality logs auth --tail 50
```

Re-mint the keys (guide 05 §3), update all files, **rebuild the frontend**, and
restart. A `pm2 restart` alone cannot fix a baked-in `VITE_` value.

## "permission denied for table …"

The grants from guide 06 §4 were not applied. Re-run that SQL block.

## Rows exist but the screen is empty

RLS is doing its job with the wrong identity. Check as the actual user:

```sql
SELECT * FROM pg_policies WHERE tablename = 'approval_documents';
SELECT public.has_role('<user-uuid>', 'Admin');
```

Confirm the user has a row in `public.user_roles` and the expected plants
assigned.

## SAP calls fail

| Symptom | Likely cause |
|---|---|
| `401` from middleware | `MIDDLEWARE_SHARED_SECRET` mismatch across app, middleware, and the Admin → SAP API Settings row |
| `ECONNREFUSED` / `ETIMEDOUT` to SAP | firewall between server and SAP; test `curl -v <sap-url>` from the server |
| `Unexpected token` parsing SAP JSON | malformed SAP payload — `json-repair.js` handles control characters; log the raw body to inspect |
| config lookup fails | `APP_BASE_URL` wrong or unreachable from the server |

```bash
pm2 logs resl-quality-mw --lines 120
curl -sv https://<sap-host>/<path> --max-time 20 2>&1 | tail -20
```

## Supabase container unhealthy

```bash
docker compose -p resl_quality ps
docker compose -p resl_quality logs db --tail 100
docker compose -p resl_quality restart rest
```

`db` refusing to start usually means a permissions problem on
`volumes/db/data` or a half-applied version upgrade — restore from the latest
dump rather than deleting the volume.

## Out of memory during build

```bash
free -h
swapon --show                       # 4 GB expected (guide 01)
```

Build on another machine and rsync `dist/`, or stop the app briefly during the
build.

## Disk full

See guide 13 §3. Fastest wins: `docker image prune -af`, `pm2 flush`, prune old
releases, vacuum journald.

## Emergency recovery

```bash
# 1. Roll back the app
cd /data/webapplication/resl_approval/Quality/scripts && ./rollback.sh

# 2. Restart everything
pm2 restart all
docker compose -p resl_quality restart
sudo systemctl restart nginx

# 3. Restore the database (destructive — confirm the archive first)
./restore.sh /data/webapplication/resl_approval/Quality/backups/<archive>.tar.gz

# 4. Maintenance page: point the site at a static holding page
#    (add a temporary `location / { return 503; }` + error_page 503 to the site)
```

Escalation order: rollback → restart → restore. Capture logs **before**
restarting anything you will need to diagnose.

Next: [15 — Production Later](./15-production-later.md)
