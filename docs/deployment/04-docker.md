# 04 — Docker Installation and Configuration

Docker runs only the Supabase stack. The application and middleware run under
PM2, not in containers.

---

## 1. Remove conflicting distro packages

```bash
for p in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do
  sudo apt -y remove "$p" 2>/dev/null || true
done
```

## 2. Add Docker's official repository

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
```

Line by line: the key is de-armoured into `/etc/apt/keyrings`, then the repo
line pins that key and resolves `noble` (24.04) automatically from
`/etc/os-release`.

## 3. Install Engine, CLI and Compose v2

```bash
sudo apt -y install docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
```

`docker-compose-plugin` provides `docker compose` (v2, a subcommand). The old
`docker-compose` v1 binary is **not** used anywhere in this handbook.

## 4. Docker service setup

```bash
sudo systemctl enable --now docker containerd
sudo systemctl is-enabled docker      # enabled
sudo systemctl status docker --no-pager
```

### Daemon configuration

Keep images and volumes on `/data` (they are the bulk of disk usage) and cap
container logs so Supabase's chatty services cannot fill the disk.

```bash
sudo systemctl stop docker
sudo mkdir -p /data/docker
sudo tee /etc/docker/daemon.json > /dev/null <<'JSON'
{
  "data-root": "/data/docker",
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" },
  "live-restore": true,
  "default-address-pools": [
    { "base": "172.30.0.0/16", "size": 24 }
  ]
}
JSON

# Move any pre-existing data
sudo rsync -aXS /var/lib/docker/ /data/docker/ 2>/dev/null || true
sudo systemctl start docker
docker info | grep -E "Docker Root Dir|Logging Driver"
```

| Setting | Reason |
|---|---|
| `data-root` | keeps `/` small; all growth lands on the `/data` volume |
| `log-opts` | 30 MB ceiling per container |
| `live-restore` | containers keep running across a daemon restart |
| `default-address-pools` | avoids clashing with corporate `172.17.x` subnets |

> Skip `data-root` if `/` already has ample space. Everything else still applies.

## 5. Docker permissions

```bash
sudo usermod -aG docker deploy
# log out and back in (group membership is applied at login)
id -nG deploy | tr ' ' '\n' | grep docker
docker ps            # works without sudo
```

Membership in the `docker` group is equivalent to root. Only `deploy` gets it.

## 6. Housekeeping

```bash
sudo tee /etc/cron.weekly/docker-prune > /dev/null <<'SH'
#!/bin/sh
/usr/bin/docker image prune -af --filter "until=336h" >/dev/null 2>&1
/usr/bin/docker builder prune -af --filter "until=336h" >/dev/null 2>&1
SH
sudo chmod +x /etc/cron.weekly/docker-prune
```

> **Never** run `docker system prune --volumes`. That deletes the Supabase
> Postgres and Storage volumes — i.e. your database.

## 7. Verification

```bash
docker --version                 # 27.x or newer
docker compose version           # v2.x
docker buildx version
docker run --rm hello-world      # prints the greeting, exits 0
docker info | grep 'Docker Root Dir'   # /data/docker
```

Next: [05 — Self-hosted Supabase](./05-supabase.md)
