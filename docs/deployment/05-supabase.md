# 05 — Self-hosted Supabase Installation

Supabase is installed from the official Docker Compose stack into
`/data/webapplication/resl_approval/Quality/supabase`.

All of it listens on `127.0.0.1` only; Nginx exposes the API gateway publicly
(guide 10).

---

## 1. Services in the stack

| Container | Role | Internal port |
|---|---|---|
| `db` (Postgres 15) | the database; all app tables, RLS policies, functions | 5432 |
| `kong` | API gateway; the single entry point (`/rest`, `/auth`, `/storage`, `/realtime`, `/functions`) | 8000 |
| `auth` (GoTrue) | sign-in, JWT issuance, password reset mails | 9999 |
| `rest` (PostgREST) | the Data API used by `supabase-js` | 3000 |
| `realtime` | Postgres change streams over WebSocket | 4000 |
| `storage` | file uploads and signed URLs | 5000 |
| `imgproxy` | image transformations for Storage | 5001 |
| `meta` | schema introspection for Studio | 8080 |
| `functions` (Edge Runtime) | Deno edge functions — **this app uses none**, but the container stays for stack completeness | 9000 |
| `studio` | admin UI | 3000 |
| `analytics` (Logflare) | log ingestion Studio reads from | 4000 |
| `vector` | log shipping into analytics | — |
| `supavisor` | connection pooler | 6543 |

## 2. Fetch the stack

```bash
sudo -iu deploy
cd /data/webapplication/resl_approval/Quality/supabase

git clone --depth 1 https://github.com/supabase/supabase.git .src
cp -r .src/docker/* .
cp .src/docker/.env.example .env
rm -rf .src/.git
ls -a           # docker-compose.yml  .env  volumes/  dev/  ...
```

Result:

```text
Quality/supabase
├── docker-compose.yml
├── docker-compose.s3.yml
├── .env                      # your configuration (chmod 600)
├── volumes
│   ├── api/kong.yml          # gateway routes
│   ├── db/                   # init SQL: roles, realtime, webhooks, jwt...
│   ├── functions/            # edge function mounts (unused here)
│   ├── logs/vector.yml
│   └── storage/              # uploaded files land here
```

## 3. Generate secrets and keys

Generate the base secrets:

```bash
openssl rand -hex 24    # POSTGRES_PASSWORD
openssl rand -hex 32    # JWT_SECRET  (min 32 chars)
openssl rand -hex 32    # SECRET_KEY_BASE
openssl rand -hex 16    # VAULT_ENC_KEY (exactly 32 hex chars)
openssl rand -hex 32    # LOGFLARE_PUBLIC_ACCESS_TOKEN
openssl rand -hex 32    # LOGFLARE_PRIVATE_ACCESS_TOKEN
openssl rand -hex 24    # DASHBOARD_PASSWORD
```

Then mint the `ANON_KEY` and `SERVICE_ROLE_KEY`. They are HS256 JWTs signed
with `JWT_SECRET`:

```bash
JWT_SECRET='<the value you generated>'
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

> The three values `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY` **must** stay
> consistent with each other. A mismatch is the single most common cause of
> `invalid JWT` / `JWSError` after installation.

## 4. Edit `.env`

Full annotated template: `deploy/quality/.env.supabase.example`. The values you
must change from the upstream example:

```ini
############ Secrets ############
POSTGRES_PASSWORD=<openssl rand -hex 24>
JWT_SECRET=<openssl rand -hex 32>
ANON_KEY=<minted above>
SERVICE_ROLE_KEY=<minted above>
SECRET_KEY_BASE=<openssl rand -hex 32>
VAULT_ENC_KEY=<openssl rand -hex 16>
LOGFLARE_PUBLIC_ACCESS_TOKEN=<openssl rand -hex 32>
LOGFLARE_PRIVATE_ACCESS_TOKEN=<openssl rand -hex 32>

############ Studio login (behind Nginx basic auth too) ############
DASHBOARD_USERNAME=studioadmin
DASHBOARD_PASSWORD=<openssl rand -hex 24>

############ Database ############
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432

############ Host ports — QUALITY ############
POSTGRES_PORT_EXT=5432
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443
STUDIO_PORT=3001          # 3000 is taken by the app

############ Public URLs — must match Nginx ############
SITE_URL=https://quality.example.com
API_EXTERNAL_URL=https://api-quality.example.com
SUPABASE_PUBLIC_URL=https://api-quality.example.com
ADDITIONAL_REDIRECT_URLS=https://quality.example.com/**

############ Auth policy ############
DISABLE_SIGNUP=true             # users are provisioned by this app
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
ENABLE_ANONYMOUS_USERS=false
ENABLE_PHONE_SIGNUP=false
ENABLE_PHONE_AUTOCONFIRM=false
JWT_EXPIRY=3600
MAILER_URLPATHS_RECOVERY=/login

############ SMTP (password reset / invite) ############
SMTP_ADMIN_EMAIL=no-reply@example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=<smtp user>
SMTP_PASS=<smtp password>
SMTP_SENDER_NAME=RESL Approvals (Quality)

############ Storage ############
FILE_SIZE_LIMIT=52428800        # 50 MB — keep in step with Nginx client_max_body_size

############ Functions (unused by this app) ############
FUNCTIONS_VERIFY_JWT=true
```

Lock the file down:

```bash
chmod 600 .env
```

### Bind everything to loopback

Edit `docker-compose.yml` and prefix every published port with `127.0.0.1:`,
for example:

```yaml
  kong:
    ports:
      - 127.0.0.1:${KONG_HTTP_PORT}:8000/tcp
  studio:
    ports:
      - 127.0.0.1:${STUDIO_PORT}:3000/tcp
  db:
    ports:
      - 127.0.0.1:${POSTGRES_PORT_EXT}:5432
```

Without this, Docker inserts its own iptables rules and the ports become
publicly reachable **even though UFW denies them**.

## 5. Volumes

Data lives on the host, under the stack directory:

| Host path | Contents | Backed up |
|---|---|---|
| `volumes/db/data` | Postgres data directory | via `pg_dump` (guide 13) |
| `volumes/storage` | uploaded files | file-level copy |
| `volumes/api/kong.yml` | gateway routes | in git |
| `volumes/functions` | edge functions (unused) | — |
| `volumes/logs` | vector config | — |

Never delete these directories, and never run
`docker compose down -v` (the `-v` removes volumes).

## 6. Start the stack

```bash
cd /data/webapplication/resl_approval/Quality/supabase
docker compose -p resl_quality pull
docker compose -p resl_quality up -d
docker compose -p resl_quality ps
```

The `-p resl_quality` project name isolates this stack from the future
Production stack. **Always** pass it.

Watch the first boot until everything reports healthy:

```bash
watch -n3 'docker compose -p resl_quality ps --format "table {{.Service}}\t{{.Status}}"'
docker compose -p resl_quality logs -f db auth rest kong
```

## 7. Everyday commands

```bash
docker compose -p resl_quality ps                 # status
docker compose -p resl_quality logs -f auth       # follow one service
docker compose -p resl_quality restart rest       # restart one service
docker compose -p resl_quality stop               # stop all (data kept)
docker compose -p resl_quality up -d              # start all
docker compose -p resl_quality down               # remove containers (volumes KEPT)
docker compose -p resl_quality pull && \
  docker compose -p resl_quality up -d            # upgrade images
```

Open a psql shell:

```bash
docker compose -p resl_quality exec db psql -U postgres -d postgres
```

## 8. Verification

```bash
# Kong is answering and requires the apikey
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/rest/v1/         # 401
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "apikey: $ANON_KEY" http://127.0.0.1:8000/rest/v1/                          # 200

# Auth health
curl -s http://127.0.0.1:8000/auth/v1/health                                     # {"version":...}

# Studio
curl -sI http://127.0.0.1:3001 | head -1                                         # 200

# Database
docker compose -p resl_quality exec db psql -U postgres -c 'select version();'
```

Next: [06 — Database Setup](./06-database-setup.md)
