#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# One-time server bootstrap for the QUALITY environment.
# Run with sudo:  sudo bash bootstrap-server.sh
# Idempotent: safe to re-run.
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT="/data/webapplication/resl_approval"
QA="$ROOT/Quality"
PROD="$ROOT/Production"
DEPLOY_USER="deploy"

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run as root (sudo)"

log "Creating the deploy user"
if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
usermod -aG sudo "$DEPLOY_USER"
getent group docker >/dev/null && usermod -aG docker "$DEPLOY_USER"

log "Creating the folder tree"
mkdir -p \
  "$QA"/{frontend/releases,backend,supabase,logs,backups,scripts,ssl,migrations} \
  "$PROD"/{frontend/releases,backend,supabase,logs,backups,scripts,ssl,migrations} \
  "$ROOT/nginx"

log "Setting ownership and permissions"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$ROOT"
chmod 755 "$ROOT" "$QA" "$PROD"
chmod 700 "$QA/ssl" "$PROD/ssl" "$QA/backups" "$PROD/backups"

log "Verifying prerequisites"
for bin in node npm pm2 docker nginx; do
  command -v "$bin" >/dev/null 2>&1 \
    && echo "  ok: $bin $($bin --version 2>/dev/null | head -1)" \
    || echo "  MISSING: $bin — see docs/deployment/0{2,3,4,9}-*.md"
done
sudo -u "$DEPLOY_USER" bash -lc 'command -v bun' >/dev/null 2>&1 \
  && echo "  ok: bun" || echo "  MISSING: bun — see docs/deployment/02-nodejs.md"

log "Configuring PM2 startup on boot"
if command -v pm2 >/dev/null 2>&1; then
  env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$DEPLOY_USER" \
    --hp "/home/$DEPLOY_USER" >/dev/null
  sudo -u "$DEPLOY_USER" bash -lc 'pm2 install pm2-logrotate || true'
  sudo -u "$DEPLOY_USER" bash -lc '
    pm2 set pm2-logrotate:max_size 20M
    pm2 set pm2-logrotate:retain 14
    pm2 set pm2-logrotate:compress true' || true
fi

log "Firewall (UFW)"
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp   >/dev/null
  ufw allow 80/tcp   >/dev/null
  ufw allow 443/tcp  >/dev/null
  ufw --force enable >/dev/null
  ufw status verbose | sed 's/^/  /'
fi

log "Result"
find "$ROOT" -maxdepth 2 -type d | sort | sed 's/^/  /'

cat <<EOS

Bootstrap complete. Next:
  1. Copy deploy/quality/nginx/*.conf   -> $ROOT/nginx/
  2. Copy deploy/quality/*.example      -> the matching .env files (chmod 600)
  3. Copy deploy/quality/ecosystem.config.cjs -> $QA/scripts/
  4. Follow docs/deployment/05-supabase.md onwards.
EOS
