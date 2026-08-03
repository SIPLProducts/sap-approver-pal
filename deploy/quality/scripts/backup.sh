#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Back up the QUALITY environment.
#   ./backup.sh           full: database + storage + env files + nginx configs
#   ./backup.sh --quick   database dump only (used by deploy.sh)
# Retention: 14 archives.
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT="/data/webapplication/resl_approval/Quality"
DEST="$ROOT/backups"
PROJECT="resl_quality"
COMPOSE="$ROOT/supabase/docker-compose.yml"
STAMP="$(date +%Y%m%d-%H%M%S)"
RETAIN=14
QUICK=0
[[ "${1:-}" == "--quick" ]] && QUICK=1

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

mkdir -p "$DEST"
command -v docker >/dev/null || die "docker not found"

DB_CID="$(docker compose -p "$PROJECT" -f "$COMPOSE" ps -q db)"
[[ -n "$DB_CID" ]] || die "Supabase db container is not running"

log "Dumping the database"
DUMP="$DEST/db-$STAMP.sql.gz"
docker exec -i "$DB_CID" pg_dump -U postgres --no-owner --no-privileges postgres \
  | gzip -9 > "$DUMP"
[[ -s "$DUMP" ]] || die "database dump is empty"
echo "  $DUMP ($(du -h "$DUMP" | cut -f1))"

if [[ $QUICK -eq 1 ]]; then
  log "Quick backup complete"
else
  log "Archiving storage, env files and nginx configs"
  ARCHIVE="$DEST/full-$STAMP.tar.gz"
  tar -czf "$ARCHIVE" \
    -C "$ROOT" \
    --transform "s|^|quality-$STAMP/|" \
    supabase/volumes/storage \
    supabase/.env \
    backend/.env \
    frontend/.env.build \
    frontend/.env.runtime \
    2>/dev/null || true
  tar -rf /dev/null --version >/dev/null 2>&1 || true
  tar -czf "$DEST/nginx-$STAMP.tar.gz" -C /data/webapplication/resl_approval nginx
  echo "  $ARCHIVE"
  echo "  $DEST/nginx-$STAMP.tar.gz"
  echo "  NOTE: env archives contain secrets. Encrypt before copying off-box:"
  echo "        gpg -c $ARCHIVE"
fi

log "Applying retention (keeping $RETAIN of each kind)"
for pat in 'db-*.sql.gz' 'full-*.tar.gz' 'nginx-*.tar.gz'; do
  ls -1t "$DEST"/$pat 2>/dev/null | tail -n "+$((RETAIN+1))" | xargs -r rm -f
done

log "Current backups"
ls -1sh "$DEST" | sed 's/^/  /'
echo
echo "Copy these off the server — a backup on the same disk is not a backup."
