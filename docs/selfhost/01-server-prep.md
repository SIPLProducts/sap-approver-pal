# 01 — Server preparation

Run everything in this document as a user with `sudo`.

## 1. Update the OS

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install curl git ca-certificates gnupg jq unzip apache2-utils
sudo timedatectl set-timezone Asia/Kolkata      # adjust to your site
timedatectl
```

Reboot if the upgrade replaced the kernel:

```bash
[ -f /var/run/reboot-required ] && sudo reboot
```

## 2. Create a deploy user

Do not run the stack as `root`.

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG sudo deploy
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh && sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

Harden SSH (`/etc/ssh/sshd_config`):

```text
PermitRootLogin no
PasswordAuthentication no
```

```bash
sudo systemctl reload ssh
```

## 3. Verify /data and create the tree

Confirm `/data` is a real mount with room to grow:

```bash
df -h /data
lsblk
```

If `/data` is a separate disk, make sure it is in `/etc/fstab` so it survives a
reboot.

Create the layout:

```bash
sudo mkdir -p /data/webapplication/resl_approval/{Quality,Production}/{app,middleware,supabase}
sudo mkdir -p /data/webapplication/resl_approval/{nginx,scripts,backups}
sudo chown -R deploy:deploy /data/webapplication
sudo chmod 750 /data/webapplication/resl_approval
find /data/webapplication -maxdepth 3 -type d
```

Env files hold secrets — keep them owner-readable only (enforced again in later
steps after you create them):

```bash
sudo chmod 700 /data/webapplication/resl_approval/{Quality,Production}
```

## 4. Copy the repository files onto the server

As `deploy`:

```bash
su - deploy
cd /data/webapplication/resl_approval

# Quality checkout
git clone https://github.com/SIPLProducts/sap-approver-pal.git Quality/app/src
# Production checkout (same repo, separate working copy)
git clone https://github.com/SIPLProducts/sap-approver-pal.git Production/app/src

# Infrastructure files shipped with the repo
cp -r Quality/app/src/deploy/data/nginx/.   nginx/
cp -r Quality/app/src/deploy/data/scripts/. scripts/
cp    Quality/app/src/deploy/data/Quality/*    Quality/
cp    Quality/app/src/deploy/data/Production/* Production/
chmod +x scripts/*.sh
```

> The `.env.*.example` files are templates. You will copy each to its real name
> and fill in secrets in steps 04, 06 and 07.

## 5. Swap file

Supabase plus two app containers benefit from swap headroom:

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

## 6. Firewall

```bash
sudo apt -y install ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

Ports 3000/3005/3006/3010/8000/8010/5432 must **not** be opened. Docker
publishes them on `127.0.0.1` only (see the compose files).

> Note: Docker can bypass UFW when a port is published as `0.0.0.0`. All
> compose files in `deploy/data/` publish as `127.0.0.1:<port>` for exactly this
> reason. If you edit them, keep the loopback prefix.

## 7. fail2ban

```bash
sudo apt -y install fail2ban
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd
```

## 8. Log rotation for host logs

Docker log rotation is configured in step 02. For Nginx, Ubuntu's default
`/etc/logrotate.d/nginx` is fine; confirm it exists:

```bash
cat /etc/logrotate.d/nginx
```

## 9. Optional: unattended security updates

```bash
sudo apt -y install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

## Verification

```bash
id deploy
df -h /data
free -h | grep -i swap
sudo ufw status | head -20
ls -l /data/webapplication/resl_approval
```

Next: [02 — Docker](./02-docker.md)
