# Fix: `node:22-alpine` pull timeout in Production/backend

Two separate things are going on.

## 1. Wrong compose file in that folder

The command ran a **build** of `sap-middleware-prod`, which means the `docker-compose.yml` currently in
`Production/backend/` is still the **middleware** file, not the Supabase stack. The Supabase stack has no
`build:` sections — it only pulls images.

- `Production/backend/docker-compose.yml` must be the Supabase self-hosted stack (copied from the repo `supabase/` folder).
- The middleware compose file belongs in `Production/middleware/`.

Check which one you have:

```bash
cd /data/webapplication/resl_approval/Production/backend
grep -c 'build:' docker-compose.yml       # Supabase stack -> 0
grep -m1 -A2 '^services:' docker-compose.yml
```

If it prints `sap-middleware-prod`, move it out:

```bash
mkdir -p ../middleware
mv docker-compose.yml ../middleware/docker-compose.yml
cp /path/to/repo/supabase/docker-compose.yml .
```

Also: Supabase stack must be started **without** `--build`:

```bash
docker compose -p resl_production --env-file .env up -d
```

## 2. Docker Hub is unreachable from this box

`dial tcp 98.87.63.243:443: i/o timeout` on `registry-1.docker.io` = the server cannot reach Docker Hub
(firewall/proxy on your network). Nothing in the app can fix that. Options, in order of preference:

### a) Confirm the block

```bash
curl -sS -o /dev/null -w '%{http_code}\n' --max-time 10 https://registry-1.docker.io/v2/
curl -sS -o /dev/null -w '%{http_code}\n' --max-time 10 https://auth.docker.io/token
```

Timeout on both = egress blocked.

### b) Configure Docker to use your corporate proxy

```bash
mkdir -p /etc/systemd/system/docker.service.d
cat >/etc/systemd/system/docker.service.d/proxy.conf <<'EOF'
[Service]
Environment="HTTP_PROXY=http://<proxy-host>:<port>"
Environment="HTTPS_PROXY=http://<proxy-host>:<port>"
Environment="NO_PROXY=localhost,127.0.0.1,10.0.0.0/8,10.150.150.0/24"
EOF
systemctl daemon-reload && systemctl restart docker
```

### c) Reuse the images Quality already pulled (no internet needed)

Quality runs the same stack on this box, so the images are already local:

```bash
docker images | grep -E 'supabase|postgres|kong|node'
```

The Supabase stack images are all pinned in the compose/`.env`, so if Quality has them, Production
starts with `up -d` and never touches the registry.

For the middleware image specifically, build it once from Quality's already-present `node:22-alpine`,
or if that tag is missing, retag/save-load it:

```bash
docker images node                       # is 22-alpine present?
# on a machine with internet:
docker pull node:22-alpine && docker save node:22-alpine -o node22alpine.tar
# on ReAprMatrix:
docker load -i node22alpine.tar
```

### d) Skip the container for the middleware

Production middleware can run bare-metal under pm2 — no image pull at all:

```bash
cd /data/webapplication/resl_approval/Production/middleware
npm install --omit=dev
PORT=3010 pm2 start server.js --name Prod_MW --time && pm2 save
curl -i http://127.0.0.1:3010/__health
```

## Recommended order

1. Move the middleware compose file out of `backend/`, put the Supabase stack there.
2. Start the backend with `up -d` (no `--build`) — it should use Quality's local images.
3. Bring up the middleware via option (d) pm2, or (c) once `node:22-alpine` is loaded locally.
4. Fix Docker's proxy config (b) later so future image pulls work normally.

No application code changes are needed for any of this.
