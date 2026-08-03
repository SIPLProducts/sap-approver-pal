#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Deploy the QUALITY environment.
#   ./deploy.sh            deploy origin/main
#   ./deploy.sh v1.4.0     deploy a tag or branch
# Aborts without touching the live release if the build fails; auto-rolls back
# if the post-deploy health check fails.
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT="/data/webapplication/resl_approval/Quality"
REF="${1:-main}"
STAMP="$(date +%Y%m%d-%H%M%S)"
APP_PORT="3000"
MW_PORT="3005"
KEEP_RELEASES=5

log()  { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m    %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

# ---------- 1. pre-flight ----------
log "Pre-flight checks"
[[ $EUID -ne 0 ]] || die "do not run as root; run as the deploy user"
for bin in git bun npm pm2 rsync; do
  command -v "$bin" >/dev/null || die "$bin not found in PATH"
done
[[ -f "$ROOT/frontend/.env.build"   ]] || die "missing $ROOT/frontend/.env.build"
[[ -f "$ROOT/frontend/.env.runtime" ]] || die "missing $ROOT/frontend/.env.runtime"
[[ -f "$ROOT/backend/.env"          ]] || die "missing $ROOT/backend/.env"
PREVIOUS="$(readlink -f "$ROOT/frontend/current" 2>/dev/null || true)"

# ---------- 2. backup ----------
log "Quick database backup"
"$ROOT/scripts/backup.sh" --quick || warn "backup skipped/failed — continuing"

# ---------- 3. fetch source ----------
log "Fetching $REF"
cd "$ROOT/frontend/repo"
git fetch --all --tags --prune
git checkout "$REF"
git pull --ff-only origin "$REF" 2>/dev/null || true
SHA="$(git rev-parse --short HEAD)"
echo "  at $REF ($SHA)"

# ---------- 4. backend ----------
log "Deploying the SAP middleware"
rsync -a --delete --exclude '.env' --exclude 'node_modules' \
  "$ROOT/frontend/repo/middleware/" "$ROOT/backend/"
cd "$ROOT/backend"
if [[ -f package-lock.json ]]; then npm ci --omit=dev; else npm install --omit=dev; fi

# ---------- 5. frontend build ----------
log "Building the app"
cd "$ROOT/frontend/repo"
cp "$ROOT/frontend/.env.build" .env
bun install --frozen-lockfile
bun run build || die "build failed — live release untouched"
[[ -d dist/server && -d dist/client ]] || die "build output incomplete"

# ---------- 6. publish release ----------
log "Publishing release $STAMP"
REL="$ROOT/frontend/releases/$STAMP"
mkdir -p "$REL"
rsync -a "$ROOT/frontend/repo/dist/" "$REL/dist/"
cat > "$REL/RELEASE_INFO" <<EOF
release=$STAMP
ref=$REF
sha=$SHA
built=$(date -Is)
by=$(whoami)
EOF

# ---------- 7. atomic swap ----------
log "Switching the current symlink"
ln -sfn "$REL" "$ROOT/frontend/current-new"
mv -Tf "$ROOT/frontend/current-new" "$ROOT/frontend/current"

# ---------- 8. reload ----------
log "Reloading PM2 processes"
pm2 reload resl-quality-mw  --update-env || pm2 start "$ROOT/scripts/ecosystem.config.cjs" --only resl-quality-mw
pm2 reload resl-quality-app --update-env || pm2 start "$ROOT/scripts/ecosystem.config.cjs" --only resl-quality-app
pm2 save

# ---------- 9. health check ----------
log "Health check"
ok=0
for i in $(seq 1 30); do
  app=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$APP_PORT/login" || true)
  mw=$(curl  -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$MW_PORT/__health" || true)
  if [[ "$app" == "200" && "$mw" == "200" ]]; then ok=1; break; fi
  sleep 2
done
if [[ $ok -ne 1 ]]; then
  warn "health check failed (app=$app mw=$mw) — rolling back"
  if [[ -n "$PREVIOUS" && -d "$PREVIOUS" ]]; then
    ln -sfn "$PREVIOUS" "$ROOT/frontend/current-new"
    mv -Tf "$ROOT/frontend/current-new" "$ROOT/frontend/current"
    pm2 reload resl-quality-app --update-env
  fi
  die "deploy rolled back; see pm2 logs resl-quality-app --err"
fi
echo "  app=200 middleware=200"

# ---------- 10. prune ----------
log "Pruning old releases (keeping $KEEP_RELEASES)"
ls -1dt "$ROOT/frontend/releases"/* | tail -n "+$((KEEP_RELEASES+1))" | xargs -r rm -rf

log "Deployed $REF ($SHA) as $STAMP"
pm2 status
