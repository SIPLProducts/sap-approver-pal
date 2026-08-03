#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Roll the QUALITY app back to a previous release.
#   ./rollback.sh                  -> previous release
#   ./rollback.sh 20260803-101500  -> a specific release
# Does NOT revert the database.
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT="/data/webapplication/resl_approval/Quality"
RELEASES="$ROOT/frontend/releases"
APP_PORT="3000"

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -ne 0 ]] || die "run as the deploy user, not root"

CURRENT="$(basename "$(readlink -f "$ROOT/frontend/current")")"

if [[ -n "${1:-}" ]]; then
  TARGET="$1"
else
  TARGET="$(ls -1dt "$RELEASES"/* | sed -n '2p' | xargs -r basename)"
fi

[[ -n "$TARGET" ]]            || die "no previous release found"
[[ -d "$RELEASES/$TARGET" ]]  || die "release $TARGET does not exist"
[[ "$TARGET" != "$CURRENT" ]] || die "$TARGET is already current"

log "Available releases"
ls -1dt "$RELEASES"/* | xargs -n1 basename | sed 's/^/  /'
echo
echo "  current: $CURRENT"
echo "  target : $TARGET"
[[ -f "$RELEASES/$TARGET/RELEASE_INFO" ]] && sed 's/^/    /' "$RELEASES/$TARGET/RELEASE_INFO"

read -r -p $'\nProceed with rollback? [y/N] ' ans
[[ "$ans" == "y" || "$ans" == "Y" ]] || die "aborted"

log "Switching symlink to $TARGET"
ln -sfn "$RELEASES/$TARGET" "$ROOT/frontend/current-new"
mv -Tf "$ROOT/frontend/current-new" "$ROOT/frontend/current"

log "Reloading the app"
pm2 reload resl-quality-app --update-env
pm2 save

log "Health check"
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$APP_PORT/login" || true)
  [[ "$code" == "200" ]] && { echo "  app=200"; break; }
  sleep 2
done
[[ "${code:-}" == "200" ]] || die "app unhealthy after rollback; check pm2 logs resl-quality-app --err"

log "Rolled back to $TARGET"
echo "NOTE: database changes were not reverted. Use restore.sh if a migration must be undone."
