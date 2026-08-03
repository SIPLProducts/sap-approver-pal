# 01 — Ubuntu Server Preparation

Target: Ubuntu 24.04 LTS. Every command is run over SSH as a user with `sudo`.

A scripted, idempotent version of this whole guide ships at
`deploy/quality/scripts/bootstrap-server.sh`. Read it, then either run it or
follow the manual steps below.

---

## 1. Update the operating system

```bash
sudo apt update                 # refresh the package index
sudo apt -y upgrade             # apply available updates
sudo apt -y dist-upgrade        # allow kernel / dependency changes
sudo apt -y autoremove          # drop orphaned packages
```

If a new kernel was installed, reboot before continuing:

```bash
[ -f /var/run/reboot-required ] && sudo reboot
```

## 2. Set hostname, timezone and NTP

```bash
sudo hostnamectl set-hostname resl-quality
sudo timedatectl set-timezone Asia/Kolkata     # use your timezone
timedatectl status                            # "System clock synchronized: yes"
```

Correct time matters: JWTs issued by Supabase Auth are time-sensitive, and a
skewed clock produces confusing "invalid token" errors.

## 3. Install required packages

```bash
sudo apt -y install \
  curl wget git ca-certificates gnupg lsb-release \
  build-essential jq unzip zip rsync \
  ufw fail2ban \
  apache2-utils \
  postgresql-client-16 \
  htop ncdu net-tools
```

Why each group:

| Package group | Reason |
|---|---|
| `curl wget git ca-certificates gnupg` | fetching source, apt keys, TLS trust |
| `build-essential` | native npm modules (`web-push`, `bcrypt`-style deps) |
| `jq unzip rsync` | scripts parse JSON, sync release folders |
| `ufw fail2ban` | firewall and SSH brute-force protection |
| `apache2-utils` | `htpasswd` for the Supabase Studio basic-auth file |
| `postgresql-client-16` | `psql` / `pg_dump` against the containerised database |
| `htop ncdu net-tools` | day-to-day diagnostics |

## 4. Create the service account

The application never runs as `root`.

```bash
sudo adduser --disabled-password --gecos "RESL deploy user" deploy
sudo usermod -aG sudo deploy            # optional: allow admin tasks
sudo mkdir -p /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
```

Install your public key so you can log in as `deploy`:

```bash
sudo tee -a /home/deploy/.ssh/authorized_keys < ~/.ssh/id_ed25519.pub
sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
```

Verify from your workstation before hardening SSH:

```bash
ssh deploy@your-server 'whoami'      # must print: deploy
```

## 5. Create the folder structure

```bash
export ROOT=/data/webapplication/resl_approval

sudo mkdir -p "$ROOT"/Quality/{frontend,backend,supabase,logs,scripts,backups,ssl}
sudo mkdir -p "$ROOT"/Production/{frontend,backend,supabase,logs,scripts,backups,ssl}
sudo mkdir -p "$ROOT"/nginx
```

Confirm:

```bash
sudo apt -y install tree
tree -L 3 /data
```

Expected output matches the tree in [README.md](./README.md#3-directory-structure).

## 6. Configure permissions

```bash
sudo chown -R deploy:deploy /data/webapplication

# Directory traversal for everyone, writable only by deploy
sudo chmod 755 /data /data/webapplication "$ROOT"

# Environments are private (they hold .env files with secrets)
sudo chmod 750 "$ROOT/Quality" "$ROOT/Production"

# Secrets and certificates: owner-only
sudo chmod 700 "$ROOT/Quality/ssl" "$ROOT/Production/ssl"
sudo chmod 750 "$ROOT/Quality/backups" "$ROOT/Production/backups"

# Nginx (running as www-data) only needs to read the server blocks
sudo chmod 755 "$ROOT/nginx"
```

Permission matrix:

| Path | Owner | Mode | Rationale |
|---|---|---|---|
| `resl_approval` | `deploy` | `755` | traversable |
| `Quality`, `Production` | `deploy` | `750` | contains `.env` secrets |
| `*/ssl` | `deploy` | `700` | private keys |
| `*/backups` | `deploy` | `750` | database dumps are sensitive |
| `*/logs` | `deploy` | `755` | readable for support |
| `nginx` | `deploy` | `755` | Nginx reads via symlink |
| any `.env` file | `deploy` | `600` | set individually in guide 11 |

## 7. Configure the firewall

Only SSH and HTTP(S) are exposed. Application ports stay on loopback.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp        comment 'SSH'
sudo ufw allow 80/tcp        comment 'HTTP redirect'
sudo ufw allow 443/tcp       comment 'HTTPS'
sudo ufw --force enable
sudo ufw status verbose
```

Do **not** open 3000, 3005, 5432, 8000 or 3001. If you must reach Studio or
Postgres from your laptop, use an SSH tunnel instead:

```bash
ssh -L 5432:127.0.0.1:5432 -L 3001:127.0.0.1:3001 deploy@your-server
```

## 8. Configure SSH

```bash
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
sudo tee /etc/ssh/sshd_config.d/99-hardening.conf > /dev/null <<'CONF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
X11Forwarding no
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
AllowUsers deploy
CONF
sudo sshd -t                      # syntax check — must be silent
sudo systemctl reload ssh
```

> Keep your current session open and confirm a **new** SSH session works
> before closing it.

Enable fail2ban for SSH:

```bash
sudo tee /etc/fail2ban/jail.local > /dev/null <<'CONF'
[sshd]
enabled  = true
maxretry = 5
bantime  = 1h
findtime = 10m
CONF
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd
```

## 9. System optimization

### Swap (protects against OOM during builds)

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

### Kernel and network tuning

```bash
sudo tee /etc/sysctl.d/99-resl.conf > /dev/null <<'CONF'
# Postgres and Node both benefit from a larger connection backlog
net.core.somaxconn = 4096
net.ipv4.tcp_max_syn_backlog = 4096
net.ipv4.ip_local_port_range = 10240 65535
net.ipv4.tcp_fin_timeout = 20
# Docker/Supabase file watching + many open sockets
fs.file-max = 2097152
fs.inotify.max_user_watches = 524288
# Prefer RAM, but allow swap under real pressure
vm.swappiness = 10
vm.overcommit_memory = 1
CONF
sudo sysctl --system
```

### File descriptor limits

```bash
sudo tee /etc/security/limits.d/99-resl.conf > /dev/null <<'CONF'
deploy soft nofile 65535
deploy hard nofile 65535
CONF
```

Also raise it for systemd-managed services (PM2's boot unit, Nginx):

```bash
sudo mkdir -p /etc/systemd/system.conf.d
sudo tee /etc/systemd/system.conf.d/99-limits.conf > /dev/null <<'CONF'
[Manager]
DefaultLimitNOFILE=65535
CONF
sudo systemctl daemon-reexec
```

Log out and back in, then verify:

```bash
ulimit -n        # 65535
```

### Unattended security updates

```bash
sudo apt -y install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## 10. Verification checklist

```bash
lsb_release -d                    # Ubuntu 24.04 LTS
id deploy                         # user exists, in sudo (and later docker)
tree -L 3 /data                   # folder structure correct
sudo ufw status                   # only 22/80/443
sudo systemctl is-active fail2ban # active
free -h | grep -i swap            # 4.0Gi
ulimit -n                         # 65535
timedatectl | grep synchronized   # yes
```

Next: [02 — Node.js Installation](./02-nodejs.md)
