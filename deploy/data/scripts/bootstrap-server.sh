#!/usr/bin/env bash
# Prepare a fresh Ubuntu server for the RESL Approval deployment.
# Idempotent: safe to re-run. Requires sudo.
set -euo pipefail

ROOT=/data/webapplication/resl_approval
DEPLOY_USER=${DEPLOY_USER:-deploy}
step() { printf '\n=== %s ===\n' "$1"; }

step "Base packages"
sudo apt-get update -y
sudo apt-get install -y curl git ca-certificates gnupg jq unzip \
  apache2-utils nginx ufw fail2ban rsync

step "Folder tree under $ROOT"
sudo mkdir -p "$ROOT"/{Quality,Production}/{app,middleware,supabase}
sudo mkdir -p "$ROOT"/{nginx,scripts,backups}
if id "$DEPLOY_USER" >/dev/null 2>&1; then
  sudo chown -R "$DEPLOY_USER:$DEPLOY_USER" /data/webapplication
else
  echo "WARN: user '$DEPLOY_USER' does not exist yet; skipping chown."
fi
sudo chmod 750 "$ROOT"
sudo chmod 700 "$ROOT/Quality" "$ROOT/Production"

step "Docker Engine + Compose v2"
if ! command -v docker >/dev/null 2>&1; then
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
else
  echo "Docker already installed: $(docker --version)"
fi
id "$DEPLOY_USER" >/dev/null 2>&1 && sudo usermod -aG docker "$DEPLOY_USER" || true

step "Docker daemon log rotation"
if [ ! -f /etc/docker/daemon.json ]; then
  sudo mkdir -p /etc/docker
  sudo tee /etc/docker/daemon.json > /dev/null <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" },
  "live-restore": true
}
JSON
  sudo systemctl restart docker
else
  echo "/etc/docker/daemon.json exists; leaving it alone."
fi
sudo systemctl enable docker containerd

step "Swap (4G)"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
else
  echo "Swap already configured."
fi

step "Firewall (22/80/443 only)"
sudo ufw --force default deny incoming
sudo ufw --force default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

step "Services"
sudo systemctl enable --now nginx fail2ban

step "Summary"
docker --version
docker compose version
nginx -v 2>&1
df -h /data | tail -1
free -h | grep -i swap
echo
echo "Done. Next: clone the repo into $ROOT/{Quality,Production}/app/src (doc 01 step 4),"
echo "then follow docs/selfhost/03-nginx-ssl.md onwards."
