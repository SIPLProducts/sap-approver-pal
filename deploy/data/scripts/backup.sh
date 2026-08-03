#!/usr/bin/env bash
# Back up one environment's Supabase database (and storage volume, if present).
#   ./backup.sh Quality
#   ./backup.sh Production
# Keeps RETAIN_DAYS of dumps in /data/webapplication/resl_approval/backups.
set -euo pipefail

ENVNAME=${1:?usage: backup.sh <Quality|Production>}
ROOT=/data/webapplication/resl_approval
OUT="$ROOT/backups"
RETAIN_DAYS=${RETAIN_DAYS:-14}
STAMP=$(date +%Y%m%d-%H%M)

case "$ENVNAME" in
  Quality)    PROJECT=resl_quality ;;
  Production) PROJECT=resl_production ;;
  *) echo "Unknown environment: $ENVNAME" >&2; exit 2 ;;
esac

mkdir -p "$OUT"

DB=$(docker compose -p "$PROJECT" ps -q db 2>/dev/null || true)
[ -n "$DB" ] || DB=$(docker ps -qf "label=com.docker.compose.project=$PROJECT" -f "name=db" | head -1)
[ -n "$DB" ] || { echo "Cannot find the 'db' container for project $PROJECT" >&2; exit 1; }

DUMP="$OUT/resl-$ENVNAME-$STAMP.dump"
echo "[$ENVNAME] dumping database -> $DUMP"
docker exec -i "$DB" pg_dump -U postgres -d postgres \
  --schema=public --schema=auth --schema=storage \
  --no-owner --no-privileges -Fc > "$DUMP"
chmod 600 "$DUMP"
ls -lh "$DUMP"

# Storage objects live in a named volume; archive it when it exists.
VOL=$(docker volume ls -q | grep -E "^${PROJECT}_storage" | head -1 || true)
if [ -n "$VOL" ]; then
  TAR="$OUT/resl-$ENVNAME-storage-$STAMP.tar.gz"
  echo "[$ENVNAME] archiving storage volume $VOL -> $TAR"
  docker run --rm -v "$VOL":/src:ro -v "$OUT":/out alpine \
    tar czf "/out/$(basename "$TAR")" -C /src .
  chmod 600 "$TAR"
else
  echo "[$ENVNAME] no storage volume found; skipping (this app uses no buckets today)."
fi

echo "[$ENVNAME] pruning backups older than $RETAIN_DAYS days"
find "$OUT" -maxdepth 1 -name "resl-$ENVNAME-*" -mtime "+$RETAIN_DAYS" -print -delete || true

echo "[$ENVNAME] backup complete at $(date -Is)"
echo "REMINDER: copy these files off this server — a backup on the same disk is not a backup."
