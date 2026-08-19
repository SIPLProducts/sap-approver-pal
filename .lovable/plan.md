# Production deployment plan — fix the current folder mix-up and start the stack

## What is wrong right now

The file you pasted at `/data/webapplication/resl_approval/Production/backend/docker-compose.yml` is **the SAP middleware compose file**, not the Supabase backend compose file. It only builds/starts the Node middleware container. It does not belong in `Production/backend/`.

Correct folder layout for Production:

```text
Production/
  backend/        # Supabase self-hosted stack (docker-compose.yml + .env + volumes/)
  middleware/     # SAP middleware (docker-compose.yml + .env + copied middleware/ sources)
  frontend/       # .env + dist/
  logs/           # nginx logs
  scripts/        # seed SQL / shell helpers
```

## 1. Fix the current state

```bash
# Remove the middleware file from the backend folder
cd /data/webapplication/resl_approval/Production/backend
rm -f docker-compose.yml

# Copy the Supabase self-hosted stack into Production/backend
cd /data/webapplication/resl_approval/Production/backend
cp -r /path/to/repo/supabase/* .
# Optional: remove any old data volume that came along
rm -rf volumes/db/data volumes/storage

# Copy the middleware compose file into Production/middleware
mkdir -p /data/webapplication/resl_approval/Production/middleware
cp /path/to/repo/deploy/production/middleware/docker-compose.yml \
   /data/webapplication/resl_approval/Production/middleware/docker-compose.yml

# Copy the middleware sources
mkdir -p /data/webapplication/resl_approval/Production/middleware
rm -rf /data/webapplication/resl_approval/Production/middleware/*
cp -r /path/to/repo/middleware/* /data/webapplication/resl_approval/Production/middleware/
```

## 2. Environment files

### Backend

```bash
cd /data/webapplication/resl_approval/Production/backend
cp /path/to/repo/deploy/production/backend/.env.example .env
chmod 600 .env
```

Fill in the secrets:

```bash
openssl rand -hex 24   # POSTGRES_PASSWORD, DASHBOARD_PASSWORD
openssl rand -hex 32   # JWT_SECRET, SECRET_KEY_BASE, LOGFLARE_* tokens
openssl rand -hex 16   # VAULT_ENC_KEY
```

Then mint `ANON_KEY` and `SERVICE_ROLE_KEY` from **that Production `JWT_SECRET`**.

### Middleware

```bash
cd /data/webapplication/resl_approval/Production/middleware
cp /path/to/repo/deploy/production/middleware/.env.example .env
chmod 600 .env
```

Edit `.env` and set `MIDDLEWARE_SHARED_SECRET` to a long random value different from Quality.

### Frontend

```bash
cd /data/webapplication/resl_approval/Production/frontend
cp /path/to/repo/deploy/production/frontend/.env.example .env
chmod 600 .env
```

Fill in the Production keys and `PORT=8090`.

## 3. Commands to start Production

### Backend (Supabase stack)

```bash
cd /data/webapplication/resl_approval/Production/backend
docker compose -p resl_production --env-file .env up -d
docker compose -p resl_production ps

# Verify
curl -i http://127.0.0.1:8010/auth/v1/health
```

Project name **must** be `resl_production` to avoid sharing containers with Quality (`resl_quality`).

### Middleware

```bash
cd /data/webapplication/resl_approval/Production/middleware
docker compose -p resl_production up -d --build

# Verify
curl -i http://127.0.0.1:3010/__health
```

Again, project name `resl_production` — never reuse `resl_quality`.

## 4. Answer your question

The file you pasted is **not** the correct `Production/backend/docker-compose.yml`. It is the middleware compose file. The backend compose file must be the one from the repo's `supabase/` folder. After fixing the folders, the commands above are what you run.

## Important notes

- Do not reuse Quality's `JWT_SECRET`. If you want fresh Production keys, keep `JWT_SECRET` different from Quality and mint new keys from it.
- `MIDDLEWARE_SHARED_SECRET` must be different from Quality.
- `POSTGRES_PORT_EXT=5442` for Production (Quality uses 5432).
- The frontend `.env` must contain `PORT=8090`, not 8080, and point to `8010` for Kong.
- After the backend starts, apply schema/seed SQL, then update the `sap_global_settings` row to set `middleware_url = 'http://127.0.0.1:3010'` and `proxy_secret` to the Production middleware secret.
