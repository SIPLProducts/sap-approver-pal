#!/usr/bin/env bash
# Restore a dump produced by backup.sh into one environment.
#   ./restore.sh Quality /data/webapplication/resl_approval/backups/resl-Quality-YYYYMMDD-HHMM.dump
#
# DESTRUCTIVE: replaces the public/auth/storage schemas in the target database.
set -euo pipefail

ENVNAME=${1:?usage: restore.sh <Quality|Production> <dump-file>}
DUMPFILE=${2:?usage: restore.sh <Quality|Production> <dump-file>}

case "$ENVNAME" in
  Quality)    PROJECT=resl_quality ;;
  Production) PROJECT=resl_production ;;
  *) echo "Unknown environment: $ENVNAME" >&2; exit 2 ;;
esac
[ -f "$DUMPFILE" ] || { echo "No such dump: $DUMPFILE" >&2; exit 1; }

DB=$(docker compose -p "$PROJECT" ps -q db 2>/dev/null || true)
[ -n "$DB" ] || DB=$(docker ps -qf "label=com.docker.compose.project=$PROJECT" -f "name=db" | head -1)
[ -n "$DB" ] || { echo "Cannot find the 'db' container for project $PROJECT" >&2; exit 1; }

echo "About to restore into $ENVNAME ($PROJECT) from:"
echo "  $DUMPFILE"
echo "This DROPS and RECREATES objects in public/auth/storage."
printf 'Type the environment name to confirm: '
read -r CONFIRM
[ "$CONFIRM" = "$ENVNAME" ] || { echo "Aborted."; exit 1; }

echo "==> copying dump into the container"
docker cp "$DUMPFILE" "$DB":/tmp/restore.dump

echo "==> ensuring extensions"
docker exec -i "$DB" psql -U postgres -d postgres -v ON_ERROR_STOP=0 -c \
  'create extension if not exists pgcrypto; create extension if not exists "uuid-ossp";'

echo "==> pg_restore (errors about missing supabase_* roles are expected)"
docker exec -i "$DB" pg_restore -U postgres -d postgres \
  --no-owner --no-privileges --clean --if-exists /tmp/restore.dump 2>&1 | tail -40 || true

echo "==> re-applying PostgREST grants"
docker exec -i "$DB" psql -U postgres -d postgres <<'SQL'
grant usage on schema public to anon, authenticated, service_role;
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t.tablename);
    execute format('grant all on public.%I to service_role', t.tablename);
  end loop;
end $$;
grant execute on all functions in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
SQL

echo "==> verification"
docker exec -i "$DB" psql -U postgres -d postgres <<'SQL'
select 'auth.users' as t, count(*) from auth.users
union all select 'profiles', count(*) from public.profiles
union all select 'sap_api_configs', count(*) from public.sap_api_configs
union all select 'approval_documents', count(*) from public.approval_documents
order by 1;

select tablename from pg_tables
where schemaname='public' and rowsecurity = false;
SQL

echo "==> restarting the stack so PostgREST reloads its schema cache"
docker compose -p "$PROJECT" restart rest auth 2>/dev/null || docker compose -p "$PROJECT" restart || true

echo "Restore of $ENVNAME complete. Any table listed above without row security must be fixed."
