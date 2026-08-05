# Add Supabase Docker stack files to the project repository

Your server at `10.150.150.130` cannot reach GitHub, so you cannot `git clone` the official Supabase Docker stack there. Instead, we will add the required Supabase self-host files directly into this project repository, push them to Git, and you will pull/clone the repository onto your server.

## What we will do

1. Download the official Supabase Docker stack files into the project under a dedicated folder.
2. Add the project's existing Supabase configuration (`config.toml` and `migrations/`) next to the stack files.
3. Provide an example `.env` file for the Quality environment so you can copy and fill it in on the server.
4. Add a deployment guide for the Git-pull workflow.
5. Push everything to Git so you can copy it to the server via `git clone` or WinSCP.

## What you will do on the server

1. Pull or extract the project repository to `/data/webapplication/resl_approval/Quality/`.
2. Copy the `supabase/` folder from the repository to `/data/webapplication/resl_approval/Quality/supabase/`.
3. Generate secrets and fill the `.env` file.
4. Edit `docker-compose.yml` to bind published ports to `127.0.0.1`.
5. Start the stack with `docker compose` and apply the migrations.

## Folder layout on the server after copy

```text
/data/webapplication/resl_approval/Quality/supabase
├── docker-compose.yml          # official Supabase stack
├── docker-compose.s3.yml       # optional S3 storage backend
├── .env.example                # reference env file (copy to .env and fill in)
├── config.toml                 # existing project config
├── migrations/                 # existing migration files
└── volumes/                    # official Supabase volumes
    ├── api/
    ├── db/
    ├── functions/
    ├── logs/
    └── storage/
```

## Required values you must fill in `.env`

- `POSTGRES_PASSWORD` — generated with `openssl rand -hex 24`
- `JWT_SECRET` — generated with `openssl rand -hex 32`
- `ANON_KEY` — minted JWT from `JWT_SECRET` for role `anon`
- `SERVICE_ROLE_KEY` — minted JWT from `JWT_SECRET` for role `service_role`
- `SECRET_KEY_BASE` — generated with `openssl rand -hex 32`
- `VAULT_ENC_KEY` — generated with `openssl rand -hex 16` (exactly 32 hex chars)
- `LOGFLARE_PUBLIC_ACCESS_TOKEN` — generated with `openssl rand -hex 32`
- `LOGFLARE_PRIVATE_ACCESS_TOKEN` — generated with `openssl rand -hex 32`
- `DASHBOARD_USERNAME=studioadmin`
- `DASHBOARD_PASSWORD` — generated with `openssl rand -hex 24`
- Ports: `POSTGRES_PORT=5432`, `KONG_HTTP_PORT=8000`, `KONG_HTTPS_PORT=8443`, `STUDIO_PORT=3001`
- Public URLs: match your Nginx hostnames or IP, e.g. `http://10.150.150.130:8081` and `http://10.150.150.130:8000`
- Auth policy: `DISABLE_SIGNUP=true`, `ENABLE_EMAIL_SIGNUP=true`, `ENABLE_EMAIL_AUTOCONFIRM=false`, `ENABLE_ANONYMOUS_USERS=false`, `JWT_EXPIRY=3600`
- SMTP settings for password reset and invite emails
- `FILE_SIZE_LIMIT=52428800` (50 MB)

## Key steps after the files are on the server

1. Generate secrets and mint the JWT keys.
2. Copy `.env.example` to `.env`, fill in the values, and run `chmod 600 .env`.
3. Edit `docker-compose.yml` and prefix `ports:` for `db`, `kong`, and `studio` with `127.0.0.1:`.
4. Start the stack: `docker compose -p resl_quality up -d`.
5. Apply migrations: `for f in migrations/*.sql; do docker compose -p resl_quality exec -T db psql -U postgres -d postgres < "$f"; done`.
6. Verify: `curl` the REST API, auth health, and Studio UI.

## Notes

- Docker images still need to be downloaded. If the server also has no internet access to Docker Hub, you will need to pull the images on another machine, save them as `.tar` files with `docker save`, transfer them to the server, and load them with `docker load`. This is a separate step that can be done after the stack files are in place.
- Do not delete `volumes/db/data` once created; it is your live database.
- The `JWT_SECRET`, `ANON_KEY`, and `SERVICE_ROLE_KEY` must stay consistent with each other.
