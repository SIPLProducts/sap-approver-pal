# 04 — Self-hosted Supabase

Do this twice: once for **Quality**, once for **Production**. The only
differences are the folder, the ports and the secrets.

## 1. Get the Supabase Docker stack

```bash
cd /data/webapplication/resl_approval/Quality/supabase
git clone --depth 1 https://github.com/supabase/supabase.git _src
cp -r _src/docker/. .
rm -rf _src
cp .env.example .env
ls
```

Repeat for `Production/supabase`.

> Pin a known-good release rather than tracking `master` in production:
> `git clone --depth 1 --branch <tag> https://github.com/supabase/supabase.git _src`

## 2. Generate secrets

Each environment needs its own set. Generate them and store them in your
password manager **before** pasting into `.env`.

```bash
# Postgres password and Studio password
openssl rand -hex 24        # POSTGRES_PASSWORD
openssl rand -hex 24        # DASHBOARD_PASSWORD
openssl rand -hex 32        # JWT_SECRET  (min 32 chars)
openssl rand -hex 32        # SECRET_KEY_BASE
openssl rand -hex 16        # VAULT_ENC_KEY (exactly 32 hex chars)
openssl rand -hex 32        # LOGFLARE_API_KEY
```

### ANON_KEY and SERVICE_ROLE_KEY

These are JWTs signed with your `JWT_SECRET`. Generate them on the server:

```bash
cd /data/webapplication/resl_approval/Quality/supabase
JWT_SECRET='<paste your JWT_SECRET>' node -e '
const crypto=require("crypto");
const secret=process.env.JWT_SECRET;
const b64=o=>Buffer.from(JSON.stringify(o)).toString("base64url");
const iat=Math.floor(Date.now()/1000), exp=iat+60*60*24*365*10;
for (const role of ["anon","service_role"]) {
  const h=b64({alg:"HS256",typ:"JWT"});
  const p=b64({role,iss:"supabase",iat,exp});
  const s=crypto.createHmac("sha256",secret).update(h+"."+p).digest("base64url");
  console.log(role.toUpperCase()+"_KEY=" + h+"."+p+"."+s);
}'
```

(`node` is available inside any Node image if the host has none:
`docker run --rm -e JWT_SECRET=... node:22-alpine node -e '...'`.)

> Rotating `JWT_SECRET` later invalidates both keys and every active session.
> Plan it as a maintenance window.

## 3. Fill in `.env`

Key values for **Quality** (`Quality/supabase/.env`):

```bash
POSTGRES_PASSWORD=<generated>
JWT_SECRET=<generated>
ANON_KEY=<generated>
SERVICE_ROLE_KEY=<generated>
SECRET_KEY_BASE=<generated>
VAULT_ENC_KEY=<generated>
LOGFLARE_PUBLIC_ACCESS_TOKEN=<generated>
LOGFLARE_PRIVATE_ACCESS_TOKEN=<generated>

DASHBOARD_USERNAME=studioadmin
DASHBOARD_PASSWORD=<generated>

# Ports (Quality)
POSTGRES_PORT=5432
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443
STUDIO_PORT=3001

# Public URLs — must match the Nginx hostnames from step 03
SITE_URL=https://quality.yourdomain.com
API_EXTERNAL_URL=https://api-quality.yourdomain.com
SUPABASE_PUBLIC_URL=https://api-quality.yourdomain.com
ADDITIONAL_REDIRECT_URLS=https://quality.yourdomain.com/**

# Auth policy — this app provisions users; public signup stays off
DISABLE_SIGNUP=true
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
ENABLE_ANONYMOUS_USERS=false
JWT_EXPIRY=3600

# SMTP for password reset / invite mails
SMTP_ADMIN_EMAIL=no-reply@yourdomain.com
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_USER=<smtp user>
SMTP_PASS=<smtp password>
SMTP_SENDER_NAME=RESL Approvals
```

For **Production** use `POSTGRES_PORT=5433`, `KONG_HTTP_PORT=8010`,
`KONG_HTTPS_PORT=8453`, `STUDIO_PORT=3011`, the production hostnames, and a
completely separate secret set.

## 4. Keep Postgres and Kong on loopback

Edit `docker-compose.yml` in each supabase folder so published ports bind to
localhost (Nginx and the app containers reach them from the host):

```yaml
    ports:
      - "127.0.0.1:${POSTGRES_PORT}:5432"
```

Do the same for `kong` (`127.0.0.1:${KONG_HTTP_PORT}:8000`) and `studio`.

## 5. Start the stack

```bash
cd /data/webapplication/resl_approval/Quality/supabase
docker compose -p resl_quality pull
docker compose -p resl_quality up -d
docker compose -p resl_quality ps
```

Always pass `-p resl_quality` / `-p resl_production`. The project name is what
keeps the two stacks' volumes and networks apart.

## 6. Verify

```bash
# Postgres
docker exec -it supabase-db psql -U postgres -c "select version();"

# REST gateway through Kong
curl -s -H "apikey: $ANON_KEY" http://127.0.0.1:8000/rest/v1/ | head -c 200

# Auth
curl -s http://127.0.0.1:8000/auth/v1/health

# Studio through Nginx (basic auth prompt expected)
curl -kI https://api-quality.yourdomain.com/studio
```

If a container restarts in a loop:

```bash
docker compose -p resl_quality logs --tail=100 <service>
```

Most first-run failures are a bad `JWT_SECRET`/key mismatch or a `VAULT_ENC_KEY`
that is not 32 characters.

## 7. Storage buckets

This application currently uses no storage buckets. If you add one later,
create it in Studio → Storage and add the matching `storage.objects` policies.

## 8. What you now own

- **Backups.** Nothing is backed up automatically. Step 08 installs the cron.
- **Upgrades.** Pin image tags; test in Quality first.
- **Keys.** `SERVICE_ROLE_KEY` bypasses RLS. It belongs only in `.env.app` on
  the server, never in a browser bundle or a Git commit.

Next: [05 — Data migration](./05-migrate-data.md)
