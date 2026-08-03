#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Restore the QUALITY database (and optionally storage) from a backup.
#   ./restore.sh /path/to/db-20260803-021500.sql.gz
#   ./restore.sh /path/to/full-20260803-021500.tar.gz --with-storage
# DESTRUCTIVE: replaces the current public schema contents.
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT="/data/webapplication/resl_approval/Quality"
PROJECT="resl_quality"
COMPOSE="$ROOT/supabase/docker-compose.yml"
SRC="${1:-}"
WITH_STORAGE=0
[[ "${2:-}" == "--with-storage" ]] && WITH_STORAGE=1

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[[ -n "$SRC" && -f "$SRC" ]] || die "usage: ./restore.sh <backup-file> [--with-storage]"

DB_CID="$(docker compose -p "$PROJECT" -f "$COMPOSE" ps -q db)"
[[ -n "$DB_CID" ]] || die "Supabase db container is not running"

log "About to restore"
echo "  source : $SRC"
echo "  target : $PROJECT / postgres"
echo "  storage: $([[ $WITH_STORAGE -eq 1 ]] && echo yes || echo no)"
read -r -p $'\nThis OVERWRITES current data. Type RESTORE to continue: ' ans
[[ "$ans" == "RESTORE" ]] || die "aborted"

log "Safety snapshot of the current state"
docker exec -i "$DB_CID" pg_dump -U postgres --no-owner --no-privileges postgres \
  | gzip > "$ROOT/backups/pre-restore-$(date +%Y%m%d-%H%M%S).sql.gz"

log "Stopping the app so nothing writes during the restore"
pm2 stop resl-quality-app resl-quality-mw || true

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

case "$SRC" in
  *.sql.gz) DUMP="$SRC" ;;
  *.tar.gz)
    log "Extracting the archive"
    tar -xzf "$SRC" -C "$WORK"
    DUMP="$(find "$WORK" -name 'db-*.sql.gz' -o -name '*.sql.gz' | head -1)"
    [[ -n "$DUMP" ]] || die "no .sql.gz dump inside the archive"
    ;;
  *) die "unsupported file type" ;;
esac

log "Dropping and recreating the public schema"
docker exec -i "$DB_CID" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
SQL

log "Loading the dump"
gunzip -c "$DUMP" | docker exec -i "$DB_CID" psql -U postgres -d postgres -v ON_ERROR_STOP=1

log "Re-applying grants"
docker exec -i "$DB_CID" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES     IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES  IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
SQL

log "Re-creating the auth.users trigger"
docker exec -i "$DB_CID" psql -U postgres -d postgres <<'SQL'
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
SQL

if [[ $WITH_STORAGE -eq 1 ]]; then
  STORE="$(find "$WORK" -type d -name storage | head -1)"
  [[ -n "$STORE" ]] && {
    log "Restoring storage files"
    rsync -a --delete "$STORE/" "$ROOT/supabase/volumes/storage/"
    docker compose -p "$PROJECT" -f "$COMPOSE" restart storage
  }
fi

log "Restarting services"
docker compose -p "$PROJECT" -f "$COMPOSE" restart rest auth
pm2 start resl-quality-mw resl-quality-app 2>/dev/null || pm2 restart resl-quality-mw resl-quality-app

log "Verification"
docker exec -i "$DB_CID" psql -U postgres -d postgres -c \
  "select count(*) as public_tables from information_schema.tables where table_schema='public';"
docker exec -i "$DB_CID" psql -U postgres -d postgres -c \
  "select count(*) as tables_without_rls from pg_tables where schemaname='public' and rowsecurity=false;"
curl -s -o /dev/null -w '  app http=%{http_code}\n' http://127.0.0.1:3000/login || true

log "Restore complete — sign in and verify one approval screen"
