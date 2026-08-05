# RESL Approval — Supabase self-hosted stack (Quality)

This folder contains the official Supabase Docker Compose stack, pre-configured for the Quality environment on the Ubuntu server at `10.150.150.130`.

Because the server has no internet access, the stack files are committed into this repository so you can copy them to the server via `git clone`, WinSCP, or any other file transfer method.

## What is included

```text
supabase/
├── docker-compose.yml              # main stack (ports bound to 127.0.0.1)
├── docker-compose.s3.yml           # optional S3/MinIO storage backend
├── docker-compose.caddy.yml        # optional Caddy HTTPS proxy
├── docker-compose.envoy.yml        # optional Envoy proxy
├── docker-compose.logs.yml         # optional Vector/Logflare logging
├── docker-compose.nginx.yml        # optional Nginx HTTPS proxy
├── docker-compose.pg15.yml         # optional Postgres 15 override
├── docker-compose.pg17.yml         # optional Postgres 17 override
├── docker-compose.rustfs.yml       # optional RustFS storage backend
├── .env.example                    # Quality env template — copy to .env
├── .env.quality.example            # same template, kept as backup name
├── config.toml                     # existing project config
├── migrations/                     # existing migration files
├── volumes/                        # stack configs mounted into containers
│   ├── api/
│   ├── db/
│   ├── functions/
│   ├── logs/
│   ├── pooler/
│   └── storage/
├── reset.sh
├── run.sh
├── setup.sh
└── update.sh
```

## Required values before starting

Copy `.env.example` to `.env` and replace every `CHANGE_ME_*` placeholder.

You must generate:

- `POSTGRES_PASSWORD` — `openssl rand -hex 24`
- `JWT_SECRET` — `openssl rand -hex 32`
- `ANON_KEY` — HS256 JWT signed with `JWT_SECRET`, role `anon`
- `SERVICE_ROLE_KEY` — HS256 JWT signed with `JWT_SECRET`, role `service_role`
- `SECRET_KEY_BASE` — `openssl rand -base64 48` (or `openssl rand -hex 32`)
- `VAULT_ENC_KEY` — `openssl rand -hex 16` (exactly 32 hex chars)
- `REALTIME_DB_ENC_KEY` — 16 characters
- `PG_META_CRYPTO_KEY` — `openssl rand -base64 24` (or a 32+ char string)
- `LOGFLARE_PUBLIC_ACCESS_TOKEN` — `openssl rand -hex 32`
- `LOGFLARE_PRIVATE_ACCESS_TOKEN` — `openssl rand -hex 32`
- `DASHBOARD_PASSWORD` — `openssl rand -hex 24`
- `S3_PROTOCOL_ACCESS_KEY_ID` — `openssl rand -hex 16`
- `S3_PROTOCOL_ACCESS_KEY_SECRET` — `openssl rand -hex 32`

### Mint the JWT keys on the server

```bash
JWT_SECRET='<paste the JWT_SECRET value here>'
IAT=$(date +%s); EXP=$((IAT + 60*60*24*365*10))    # 10 years

mint() {
  header=$(printf '{"alg":"HS256","typ":"JWT"}' | openssl base64 -A | tr '+/' '-_' | tr -d '=')
  payload=$(printf '{"role":"%s","iss":"supabase","iat":%s,"exp":%s}' "$1" "$IAT" "$EXP" \
    | openssl base64 -A | tr '+/' '-_' | tr -d '=')
  sig=$(printf '%s.%s' "$header" "$payload" \
    | openssl dgst -binary -sha256 -hmac "$JWT_SECRET" \
    | openssl base64 -A | tr '+/' '-_' | tr -d '=')
  printf '%s.%s.%s\n' "$header" "$payload" "$sig"
}

echo "ANON_KEY=$(mint anon)"
echo "SERVICE_ROLE_KEY=$(mint service_role)"
```

Paste the resulting `ANON_KEY` and `SERVICE_ROLE_KEY` into `.env`.

After editing, lock the file:

```bash
chmod 600 /data/webapplication/resl_approval/Quality/supabase/.env
```

## Server setup steps

### 1. Copy the stack files to the server

```bash
sudo -iu deploy
mkdir -p /data/webapplication/resl_approval/Quality

# Option A: clone the full repository (if the server can reach Git)
cd /data/webapplication/resl_approval/Quality
git clone <repository-url> .

# Option B: copy only the supabase/ folder from your local machine via WinSCP
# Then place it at:
# /data/webapplication/resl_approval/Quality/supabase
```

### 2. Back up your existing `config.toml` and `migrations/`

```bash
cd /data/webapplication/resl_approval/Quality/supabase
BACKUP_DIR="../supabase-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r config.toml migrations "$BACKUP_DIR/"
```

### 3. Create `.env` from `.env.example`

```bash
cd /data/webapplication/resl_approval/Quality/supabase
cp .env.example .env
# edit .env and replace all CHANGE_ME_* values
chmod 600 .env
```

The example file is already pre-filled for the Nginx config in `deploy/quality/nginx/resl-approval-quality-single-host.conf`:

- Kong on `127.0.0.1:8000`
- Studio on `127.0.0.1:3000`
- Postgres on `127.0.0.1:5432`
- Supavisor on `127.0.0.1:5432` (session) and `127.0.0.1:6543` (transaction)

All published ports are already bound to `127.0.0.1` in `docker-compose.yml`, so they are not exposed to the public network directly.

### 4. Docker images

If the server has internet access to Docker Hub, pull them:

```bash
cd /data/webapplication/resl_approval/Quality/supabase
docker compose -p resl_quality pull
```

If the server is **completely offline**, you must pull the images on another machine and transfer them:

```bash
# On a machine with internet
mkdir ~/resl-images && cd ~/resl-images
for img in $(grep -oE 'image: [^ ]+' /path/to/docker-compose.yml | sed 's/image: //'); do
  docker pull "$img"
  docker save "$img" -o "$(echo "$img" | tr '/:@' '_').tar"
done

# Transfer the .tar files to the server, then load them:
for f in /path/to/resl-images/*.tar; do
  docker load -i "$f"
done
```

### 5. Start the stack

```bash
cd /data/webapplication/resl_approval/Quality/supabase
docker compose -p resl_quality up -d
docker compose -p resl_quality ps
```

Watch until every service is healthy:

```bash
watch -n3 'docker compose -p resl_quality ps --format "table {{.Service}}\t{{.Status}}"'
```

### 6. Apply migrations

The `migrations/` folder in this project contains the existing SQL migrations. Apply them in filename order:

```bash
cd /data/webapplication/resl_approval/Quality/supabase
for f in migrations/*.sql; do
  docker compose -p resl_quality exec -T db psql -U postgres -d postgres < "$f"
done
```

### 7. Verify

```bash
# Kong REST API (anon key required)
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/rest/v1/
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "apikey: <ANON_KEY>" http://127.0.0.1:8000/rest/v1/

# Auth service health
curl -s http://127.0.0.1:8000/auth/v1/health

# Studio UI
curl -sI http://127.0.0.1:3000 | head -1

# Database
docker compose -p resl_quality exec db psql -U postgres -c 'select version();'
```

## Troubleshooting

- **Container restarts in a loop:**

  ```bash
  docker compose -p resl_quality logs --tail=100 <service>
  ```

- **`invalid JWT` / `JWSError`:**
  The `JWT_SECRET`, `ANON_KEY`, and `SERVICE_ROLE_KEY` are inconsistent. Regenerate all three together.

- **`VAULT_ENC_KEY` errors:**
  This key must be exactly 32 hex characters (16 bytes). Generate with `openssl rand -hex 16`.

- **`REALTIME_DB_ENC_KEY` errors:**
  This key must be exactly 16 characters.

- **Ports already in use:**
  Make sure no other service is using `8000`, `3000`, `5432`, or `6543` on the host. If they are, change the corresponding `*_PORT` values in `.env` and update the Nginx upstream config.

## Important notes

- Never delete `volumes/db/data` once created; it contains your live database.
- Never run `docker compose down -v` (the `-v` removes volumes and deletes data).
- Back up the database with `pg_dump` regularly.
- The `SERVICE_ROLE_KEY` bypasses RLS. Keep it only in `.env` and server-side app config.
