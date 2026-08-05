# Deploy Supabase on an air-gapped / offline Ubuntu server

The server at `10.150.150.130` cannot reach GitHub (`git clone` failed). The original plan assumed the server could download the Supabase Docker stack directly. We need an alternative that works without internet access from the server.

## What we will do

1. **Prepare the Supabase Docker stack files on a machine with internet** (your workstation or another jump host), then transfer them to the server with WinSCP/SCP.
2. **Pull the required Docker images on the same internet-connected machine**, save them as `.tar` files, and transfer them to the server.
3. **On the server, load the transferred images into Docker**, start the stack, and verify it.
4. **Generate secrets and create the `.env` file** either on the server or offline and copy it in.
5. **Apply your existing migrations** to the running Postgres database.

## Required prerequisite

You need at least one machine that has:

- Internet access (to download the stack and pull Docker images).
- Docker and `git` installed.
- A way to move files to the Ubuntu server (WinSCP, SCP, USB, shared network drive).

If you have no such machine, the only remaining option is to use an external Supabase instance or Supabase Cloud instead of self-hosting.

## Option A — Offline transfer (recommended if you have an internet machine)

### Step 1 — Download the Supabase stack files

On a machine with internet:

```bash
mkdir -p ~/resl-supabase-offline
mkdir -p ~/resl-supabase-offline/images
cd ~/resl-supabase-offline

git clone --depth 1 https://github.com/supabase/supabase.git .src
cp -r .src/docker/* ./
cp .src/docker/.env.example ./.env.example
rm -rf .src
```

Resulting files to transfer:

```text
~/resl-supabase-offline
├── docker-compose.yml
├── docker-compose.s3.yml
├── .env.example
├── dev/
└── volumes/
    ├── api/
    ├── db/
    ├── functions/
    ├── logs/
    └── storage/
```

Compress and transfer them to the server:

```bash
# On internet machine
zip -r supabase-stack.zip docker-compose.yml docker-compose.s3.yml .env.example dev/ volumes/
# Move supabase-stack.zip to the server via WinSCP/SCP
```

### Step 2 — Pull and export Docker images

On the same internet machine, download every image referenced in `docker-compose.yml` and save them as `.tar` files:

```bash
cd ~/resl-supabase-offline/images

# Extract all image:tag lines from the compose file
# (values may vary by Supabase release; always use the exact compose file you transferred)
for img in $(grep -oE 'image: [^ ]+' ../docker-compose.yml | sed 's/image: //'); do
  docker pull "$img"
  docker save "$img" -o "$(echo "$img" | tr '/:@' '_').tar"
done

ls -lh
```

Transfer the `.tar` files to the server via WinSCP/SCP.

### Step 3 — On the server: unpack the stack files and load images

```bash
sudo -iu deploy
cd /data/webapplication/resl_approval/Quality/supabase

# Back up your existing files
BACKUP_DIR="../supabase-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r config.toml migrations "$BACKUP_DIR/"

# Unzip the transferred stack files
unzip /path/to/supabase-stack.zip -d /tmp/supabase-stack
cp -r /tmp/supabase-stack/* ./

# Load images
for f in /path/to/images/*.tar; do
  docker load -i "$f"
done
```

### Step 4 — Generate secrets and fill `.env`

Generate secrets on the server (does not need internet):

```bash
openssl rand -hex 24    # POSTGRES_PASSWORD
openssl rand -hex 32    # JWT_SECRET
openssl rand -hex 32    # SECRET_KEY_BASE
openssl rand -hex 16    # VAULT_ENC_KEY
openssl rand -hex 32    # LOGFLARE_PUBLIC_ACCESS_TOKEN
openssl rand -hex 32    # LOGFLARE_PRIVATE_ACCESS_TOKEN
openssl rand -hex 24    # DASHBOARD_PASSWORD
```

Mint `ANON_KEY` and `SERVICE_ROLE_KEY` from the same `JWT_SECRET`:

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

Create `.env` from `.env.example` using the values above. Use the template in `deploy/quality/.env.supabase.example` as the reference. Key Quality values:

- `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `SECRET_KEY_BASE`, `VAULT_ENC_KEY`, `LOGFLARE_PUBLIC_ACCESS_TOKEN`, `LOGFLARE_PRIVATE_ACCESS_TOKEN` — generated above
- `DASHBOARD_USERNAME=studioadmin`
- `DASHBOARD_PASSWORD` — generated above
- Ports: `POSTGRES_PORT=5432`, `KONG_HTTP_PORT=8000`, `KONG_HTTPS_PORT=8443`, `STUDIO_PORT=3001`
- Public URLs: match your Nginx hostnames (e.g. `http://10.150.150.130:8081` for the app, `http://10.150.150.130:8000` for the API if not using a proxy hostname)
- Auth policy: `DISABLE_SIGNUP=true`, `ENABLE_EMAIL_SIGNUP=true`, `ENABLE_EMAIL_AUTOCONFIRM=false`, `ENABLE_ANONYMOUS_USERS=false`, `JWT_EXPIRY=3600`
- SMTP settings for password reset / invite emails
- `FILE_SIZE_LIMIT=52428800` (50 MB)

Lock the file:

```bash
chmod 600 /data/webapplication/resl_approval/Quality/supabase/.env
```

### Step 5 — Bind published ports to loopback

Edit `docker-compose.yml` and prefix every `ports:` entry with `127.0.0.1:`, especially for `db`, `kong`, and `studio`. This prevents Docker from exposing them publicly through its own iptables rules.

Example:

```yaml
  db:
    ports:
      - "127.0.0.1:${POSTGRES_PORT}:5432"
  kong:
    ports:
      - "127.0.0.1:${KONG_HTTP_PORT}:8000"
  studio:
    ports:
      - "127.0.0.1:${STUDIO_PORT}:3000"
```

### Step 6 — Start the stack

Because the images are already loaded, skip `docker compose pull`:

```bash
cd /data/webapplication/resl_approval/Quality/supabase
docker compose -p resl_quality up -d
docker compose -p resl_quality ps

watch -n3 'docker compose -p resl_quality ps --format "table {{.Service}}\t{{.Status}}"'
```

### Step 7 — Apply migrations

Once `db` and `rest` are healthy, apply the existing SQL migration files in filename order:

```bash
cd /data/webapplication/resl_approval/Quality/supabase
for f in migrations/*.sql; do
  docker compose -p resl_quality exec -T db psql -U postgres -d postgres < "$f"
done
```

### Step 8 — Verify

```bash
# Kong REST API (anon key required)
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/rest/v1/
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "apikey: <ANON_KEY>" http://127.0.0.1:8000/rest/v1/

# Auth service health
curl -s http://127.0.0.1:8000/auth/v1/health

# Studio UI
curl -sI http://127.0.0.1:3001 | head -1

# Database
docker compose -p resl_quality exec db psql -U postgres -c 'select version();'
```

## Option B — Use an existing external Supabase instance

If you already have a Supabase instance running elsewhere (another server, Supabase Cloud, or an existing Quality/Production instance), you can point this deployment to it instead of creating a new one.

What changes in the app configuration:

- `SUPABASE_URL` / `VITE_SUPABASE_URL` points to the existing instance.
- `SUPABASE_ANON_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` is the existing anon key.
- `SUPABASE_SERVICE_ROLE_KEY` is the existing service role key.
- The app migrations are applied to the existing instance instead of a new local Postgres.

This option avoids Docker entirely, but it still requires you to apply the migration SQL files to the external database.

## Option C — Use Supabase Cloud

Create a project on Supabase Cloud (or another managed Supabase provider). The trade-off is a monthly cost and no local data, but it removes the need for any server-side Supabase installation.

- Export the migrations and apply them to the cloud project via the Supabase CLI.
- Update the app `.env` files with the cloud project's URL and keys.

## What you need to provide

1. Do you have a Windows/Linux machine with internet access that can transfer files to `10.150.150.130`? (This determines whether Option A is feasible.)
2. Is Docker already installed on the Ubuntu server?
3. Is the server completely air-gapped, or can it reach a private Docker registry or a jump host?
4. Do you already have an external Supabase/Postgres instance you want to use instead? (Option B)
5. Your public hostname or IP for `SITE_URL`, `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL`, and `ADDITIONAL_REDIRECT_URLS`.
6. SMTP server details for password reset and invite emails.

## Risks and notes

- The `JWT_SECRET`, `ANON_KEY`, and `SERVICE_ROLE_KEY` must stay consistent. A mismatch is the most common cause of `invalid JWT` / `JWSError` errors.
- Do not delete `volumes/db/data` once created; that is your live database. Back it up with `pg_dump`.
- Docker images for Supabase can total several GB. Make sure the transfer medium has enough space.
- If a container restarts in a loop, check logs with `docker compose -p resl_quality logs --tail=100 <service>`.
- The migrations in `migrations/` must be applied after Postgres is ready.
