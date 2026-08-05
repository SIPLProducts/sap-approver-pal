# Deploy Supabase self-host from your existing migrations

You already have the Lovable Cloud migration files (`config.toml` and `migrations/`), but those are not enough to run Supabase locally. You need the official Supabase Docker stack files (`docker-compose.yml`, `.env`, `volumes/`, etc.) in the same folder. This plan creates those files, preserves your existing work, and brings the stack up.

## What we will do

1. **Back up your current Supabase folder** so `config.toml` and `migrations/` are safe.
2. **Fetch the official Supabase Docker stack** into `Quality/supabase/`.
3. **Restore your `migrations/` folder** into the fetched stack so they can be applied.
4. **Generate secrets** and mint the JWT-based `ANON_KEY` and `SERVICE_ROLE_KEY`.
5. **Create the `.env` file** with the Quality ports and auth policy you already use in the project.
6. **Bind all published ports to `127.0.0.1`** so Nginx can proxy them safely.
7. **Start the stack** and verify every service is healthy.
8. **Apply your migrations** to the running Postgres database.

## Expected final state

```text
/data/webapplication/resl_approval/Quality/supabase
├── docker-compose.yml          # official Supabase stack
├── .env                        # your secrets and ports (chmod 600)
├── config.toml                 # your existing project config
├── migrations/                 # your existing migration files
└── volumes/                    # created by Docker on first boot
    ├── api/kong.yml
    ├── db/data
    ├── functions/
    ├── logs/vector.yml
    └── storage/
```

## Detailed steps

### Step 1 — Back up existing files

Create a timestamped backup of `config.toml` and `migrations/` before pulling the Docker stack.

```bash
sudo -iu deploy
cd /data/webapplication/resl_approval/Quality/supabase
BACKUP_DIR="../supabase-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r config.toml migrations "$BACKUP_DIR/"
ls -la "$BACKUP_DIR"
```

### Step 2 — Fetch the official Supabase Docker stack

```bash
cd /data/webapplication/resl_approval/Quality/supabase
git clone --depth 1 https://github.com/supabase/supabase.git .src
cp -r .src/docker/* .
cp .src/docker/.env.example .env
rm -rf .src
```

After this step the folder contains `docker-compose.yml`, `volumes/`, `dev/`, and the template `.env`. Your `migrations/` and `config.toml` remain in place.

### Step 3 — Generate secrets and keys

Generate the base secrets and store them in a password manager before pasting into `.env`:

```bash
openssl rand -hex 24    # POSTGRES_PASSWORD
openssl rand -hex 32    # JWT_SECRET
openssl rand -hex 32    # SECRET_KEY_BASE
openssl rand -hex 16    # VAULT_ENC_KEY
openssl rand -hex 32    # LOGFLARE_PUBLIC_ACCESS_TOKEN
openssl rand -hex 32    # LOGFLARE_PRIVATE_ACCESS_TOKEN
openssl rand -hex 24    # DASHBOARD_PASSWORD
```

Mint the JWT keys using the same `JWT_SECRET`:

```bash
JWT_SECRET='<paste your JWT_SECRET>'
IAT=$(date +%s); EXP=$((IAT + 60*60*24*365*10))

mint() {
  header=$(printf '{"alg":"HS256","typ":"JWT"}' | openssl base64 -A | tr '+/' '-_' | tr -d '=')
  payload=$(printf '{"role":"%s","iss":"supabase","iat":%s,"exp":%s}' "$1" "$IAT" "$EXP" \
    | openssl base64 -A | tr '+/' '-_' | tr -d '=')
  sig=$(printf '%s.%s' "$header" "$payload" \
    | openssl dgst -binary -sha256 -hmac "$JWT_SECRET" \
    | openssl base64 -A | tr '+/' '-_' | tr -d '=')
  printf '%s.%s.%s\n' "$header" "$payload" "$sig"
}

mint anon
mint service_role
```

### Step 4 — Fill in `.env`

Use the example file at `deploy/data/Quality/.env.supabase.example` as the reference. The key values for Quality are:

- `POSTGRES_PASSWORD` — generated
- `JWT_SECRET` — generated
- `ANON_KEY` — minted from JWT_SECRET
- `SERVICE_ROLE_KEY` — minted from JWT_SECRET
- `SECRET_KEY_BASE` — generated
- `VAULT_ENC_KEY` — generated (32 hex chars)
- `LOGFLARE_PUBLIC_ACCESS_TOKEN` — generated
- `LOGFLARE_PRIVATE_ACCESS_TOKEN` — generated
- `DASHBOARD_USERNAME=studioadmin`
- `DASHBOARD_PASSWORD` — generated
- Ports: `POSTGRES_PORT=5432`, `KONG_HTTP_PORT=8000`, `KONG_HTTPS_PORT=8443`, `STUDIO_PORT=3001`
- Public URLs: match your Nginx hostnames (e.g. `SITE_URL`, `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL`)
- Auth policy: `DISABLE_SIGNUP=true`, `ENABLE_EMAIL_SIGNUP=true`, `ENABLE_EMAIL_AUTOCONFIRM=false`, `ENABLE_ANONYMOUS_USERS=false`, `JWT_EXPIRY=3600`
- SMTP settings for password reset / invite mails
- `FILE_SIZE_LIMIT=52428800` (50 MB)

Then lock it down:

```bash
chmod 600 /data/webapplication/resl_approval/Quality/supabase/.env
```

### Step 5 — Bind published ports to loopback

Edit `docker-compose.yml` and prefix every `ports:` entry with `127.0.0.1:`, especially `db`, `kong`, and `studio`. This prevents Docker from exposing them publicly through its own iptables rules.

Example snippet for the `db` service:

```yaml
  db:
    ports:
      - "127.0.0.1:${POSTGRES_PORT}:5432"
```

Do the same for `kong` and `studio` (and any other service that publishes ports).

### Step 6 — Start the stack

```bash
cd /data/webapplication/resl_approval/Quality/supabase
docker compose -p resl_quality pull
docker compose -p resl_quality up -d
docker compose -p resl_quality ps
```

Watch the first boot until all services report healthy:

```bash
watch -n3 'docker compose -p resl_quality ps --format "table {{.Service}}\t{{.Status}}"'
```

### Step 7 — Apply migrations

Once the `db` and `rest` services are healthy, apply your migration files. Because this is a self-hosted Supabase instance, use the `supabase` CLI or run the SQL files directly against Postgres. The migrations in `migrations/` are plain SQL and can be applied in filename order via `psql`:

```bash
cd /data/webapplication/resl_approval/Quality/supabase
# list migration files in order
ls -1 migrations/*.sql

# apply them one by one in order
for f in migrations/*.sql; do
  docker compose -p resl_quality exec -T db psql -U postgres -d postgres < "$f"
done
```

If you prefer the Supabase CLI, install it and run `supabase db reset` or `supabase migration up` from the `supabase` folder after pointing `config.toml` to the local database.

### Step 8 — Verify

```bash
# Kong REST API (anon key required)
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/rest/v1/  # 401 expected
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "apikey: <ANON_KEY>" http://127.0.0.1:8000/rest/v1/  # 200 expected

# Auth service health
curl -s http://127.0.0.1:8000/auth/v1/health

# Studio UI
curl -sI http://127.0.0.1:3001 | head -1

# Database
docker compose -p resl_quality exec db psql -U postgres -c 'select version();'
```

## What you need to provide

- Your public hostnames (or IP) for `SITE_URL`, `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL`, and `ADDITIONAL_REDIRECT_URLS`.
- SMTP server details (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_ADMIN_EMAIL`) so password reset and invite emails work.
- Whether you want to apply migrations with `psql` (fastest, no extra tool) or the Supabase CLI.

## Risks and notes

- The `JWT_SECRET`, `ANON_KEY`, and `SERVICE_ROLE_KEY` must stay consistent. A mismatch is the most common cause of `invalid JWT` / `JWSError` errors.
- Do not delete `volumes/db/data` once created; that is your live database. Backups are covered in a separate guide.
- If a container restarts in a loop, check logs with `docker compose -p resl_quality logs --tail=100 <service>`.
- The `migrations/` folder you already have will be applied after the stack is healthy; do not run them before Postgres is ready.