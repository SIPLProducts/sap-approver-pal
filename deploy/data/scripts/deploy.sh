#!/usr/bin/env bash
# Deploy (or redeploy) one environment.
#   ./deploy.sh Quality
#   ./deploy.sh Production [git-ref]
set -euo pipefail

ENVNAME=${1:?usage: deploy.sh <Quality|Production> [git-ref]}
GITREF=${2:-}
ROOT=/data/webapplication/resl_approval
ENVDIR="$ROOT/$ENVNAME"
SRC="$ENVDIR/app/src"

case "$ENVNAME" in
  Quality)    PROJECT_APP=resl_quality_app;    PROJECT_MW=resl_quality_mw;    PORT=3000 ;;
  Production) PROJECT_APP=resl_production_app; PROJECT_MW=resl_production_mw; PORT=3010 ;;
  *) echo "Unknown environment: $ENVNAME" >&2; exit 2 ;;
esac

step() { printf '\n=== [%s] %s ===\n' "$ENVNAME" "$1"; }

[ -d "$SRC/.git" ]            || { echo "Missing checkout at $SRC" >&2; exit 1; }
[ -f "$ENVDIR/.env.app" ]        || { echo "Missing $ENVDIR/.env.app" >&2; exit 1; }
[ -f "$ENVDIR/.env.middleware" ] || { echo "Missing $ENVDIR/.env.middleware" >&2; exit 1; }

step "Update source"
cd "$SRC"
git fetch --all --prune
if [ -n "$GITREF" ]; then
  git checkout "$GITREF"
  git pull --ff-only origin "$GITREF" 2>/dev/null || true
else
  git pull --ff-only
fi
echo "HEAD: $(git rev-parse --short HEAD) $(git log -1 --pretty=%s)"

cd "$ENVDIR"

step "Build app image"
docker compose --env-file .env.app -p "$PROJECT_APP" build app

step "Restart app"
docker compose --env-file .env.app -p "$PROJECT_APP" up -d app

step "Build + restart middleware"
docker compose --env-file .env.middleware -p "$PROJECT_MW" up -d --build middleware

step "Health check (http://127.0.0.1:$PORT/login)"
ok=0
for i in $(seq 1 40); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/login"; then ok=1; break; fi
  sleep 3
done
if [ "$ok" -ne 1 ]; then
  echo "FAILED: app did not become healthy. Last 60 log lines:" >&2
  docker compose -p "$PROJECT_APP" logs --tail=60 app >&2 || true
  exit 1
fi
echo "App healthy."

MWPORT=$([ "$ENVNAME" = "Quality" ] && echo 3005 || echo 3006)
if curl -fsS "http://127.0.0.1:$MWPORT/__health" >/dev/null; then
  echo "Middleware healthy."
else
  echo "WARN: middleware health check failed on port $MWPORT." >&2
fi

step "Running containers"
docker ps --filter "name=resl-" --format 'table {{.Names}}\t{{.Status}}'
echo
echo "Deploy of $ENVNAME complete."
