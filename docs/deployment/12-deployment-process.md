# 12 — Deployment Process

Scripts live in `Quality/scripts/` (sources: `deploy/quality/scripts/`).

| Script | Purpose |
|---|---|
| `bootstrap-server.sh` | one-time: folders, permissions, PM2 startup |
| `deploy.sh` | build + release + reload (the everyday command) |
| `rollback.sh` | repoint `current` to the previous release |
| `backup.sh` | database + storage + env backup |
| `restore.sh` | restore from a backup archive |

---

## 1. First deployment (order matters)

```bash
# 1. Server prep, Node, PM2, Docker            -> guides 01–04
sudo bash /data/webapplication/resl_approval/Quality/scripts/bootstrap-server.sh

# 2. Supabase up, schema + data loaded         -> guides 05–06
# 3. Middleware installed and running          -> guide 07
# 4. App built and running                     -> guide 08
# 5. Nginx installed and configured            -> guides 09–10
# 6. Verify
pm2 status
curl -sI https://quality.yourdomain.com/login | head -1
```

## 2. Routine deployment

```bash
sudo -iu deploy
cd /data/webapplication/resl_approval/Quality/scripts
./deploy.sh                 # deploys main
./deploy.sh v1.4.0          # deploys a tag or branch
```

What `deploy.sh` does, in order:

1. **Pre-flight** — refuses to run as root; checks `bun`, `npm`, `pm2`, and
   that the env files exist.
2. **Backup** — calls `backup.sh --quick` (database dump only) so there is a
   restore point.
3. **Fetch** — `git fetch --all --tags && git checkout <ref> && git pull` in
   `frontend/repo`, recording the commit SHA.
4. **Backend** — rsync `middleware/` → `backend/`, `npm ci --omit=dev`.
5. **Frontend build** — copy `.env.build` into the repo, `bun install
   --frozen-lockfile`, `bun run build`. **Aborts the whole deploy if the build
   fails — the live release is untouched.**
6. **Release** — copy `dist/` into `releases/<timestamp>/`, write a
   `RELEASE_INFO` file (SHA, ref, date).
7. **Swap** — atomic symlink move of `current`.
8. **Reload** — `pm2 reload resl-quality-mw resl-quality-app`, then `pm2 save`.
9. **Health check** — polls `http://127.0.0.1:3000/login` and
   `http://127.0.0.1:3005/__health` for up to 60 s. **On failure it rolls back
   automatically** and exits non-zero.
10. **Prune** — keeps the newest 5 releases.

Zero-downtime notes: `pm2 reload` starts the replacement before killing the old
process, and the symlink swap is atomic, so in-flight requests are never served
a half-copied build. The brief SSR restart is the only gap; Nginx retries via
`proxy_next_upstream` on connection refusal.

## 3. Rollback

```bash
./rollback.sh                 # previous release
./rollback.sh 20260803-101500 # a specific release
ls -1 ../frontend/releases    # what is available
```

It repoints `current`, reloads PM2, and health-checks. It does **not** revert
the database — if the release included a migration, restore the dump taken in
step 2 (`restore.sh`).

## 4. Database migrations

Migrations are plain SQL, applied before the app that needs them:

```bash
cd /data/webapplication/resl_approval/Quality
./scripts/backup.sh --quick
CID=$(docker compose -p resl_quality -f supabase/docker-compose.yml ps -q db)
docker exec -i "$CID" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < migrations/2026xxxx_name.sql
./scripts/deploy.sh
```

Write migrations additively (add nullable columns, backfill, then constrain) so
a rollback of the app code still works against the new schema.

## 5. Checklists

**Before**
- [ ] `pm2 status` all `online`
- [ ] `docker compose -p resl_quality ps` all healthy
- [ ] `df -h /data` — more than 20 % free
- [ ] backup succeeded
- [ ] release notes / migration reviewed

**After**
- [ ] `pm2 status` — restart counters not climbing
- [ ] sign in, open one SD screen and one MM screen
- [ ] execute one SAP-backed report end to end
- [ ] `pm2 logs --lines 50` — no errors
- [ ] `sudo tail -50 /var/log/nginx/resl-quality-app.error.log`

## 6. Verification

```bash
cat ../frontend/current/RELEASE_INFO
pm2 status
curl -sI https://quality.yourdomain.com/login | head -1
```

Next: [13 — Monitoring & Maintenance](./13-monitoring.md)
