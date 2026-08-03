# 02 — Docker Engine & Compose

## 1. Remove distro packages

```bash
for p in docker.io docker-doc docker-compose podman-docker containerd runc; do
  sudo apt -y remove $p 2>/dev/null || true
done
```

## 2. Install from Docker's apt repository

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt -y install docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
```

## 3. Let the deploy user run Docker

```bash
sudo usermod -aG docker deploy
# log out and back in, then:
docker ps
```

## 4. Daemon configuration

Keep Docker's data on `/data` (images and volumes are the bulk of the disk
usage) and cap container logs:

```bash
sudo systemctl stop docker
sudo mkdir -p /data/docker
sudo tee /etc/docker/daemon.json > /dev/null <<'JSON'
{
  "data-root": "/data/docker",
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" },
  "live-restore": true
}
JSON
# Move existing data if Docker was already used:
sudo rsync -aXS /var/lib/docker/ /data/docker/ 2>/dev/null || true
sudo systemctl start docker
docker info | grep -E "Docker Root Dir|Logging Driver"
```

> Skip the `data-root` change if `/` already has ample space and you prefer
> Docker's defaults. Everything else in this guide works either way.

## 5. Enable on boot

```bash
sudo systemctl enable docker containerd
sudo systemctl is-enabled docker
```

## 6. Verify

```bash
docker run --rm hello-world
docker compose version     # must print v2.x
docker buildx version
```

## 7. Housekeeping

Add a weekly prune so old build layers do not fill `/data`:

```bash
sudo tee /etc/cron.weekly/docker-prune > /dev/null <<'SH'
#!/bin/sh
/usr/bin/docker image prune -af --filter "until=336h" >/dev/null 2>&1
/usr/bin/docker builder prune -af --filter "until=336h" >/dev/null 2>&1
SH
sudo chmod +x /etc/cron.weekly/docker-prune
```

> Do **not** run `docker system prune --volumes`. That would delete the
> Supabase Postgres and Storage volumes.

Next: [03 — Nginx & TLS](./03-nginx-ssl.md)
