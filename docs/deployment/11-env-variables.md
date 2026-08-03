# 11 — Environment Variables

Four environment files. All are `chmod 600`, owned by `deploy`, and **never**
committed to git.

| File | Read by | When |
|---|---|---|
| `Quality/frontend/.env.build` | `bun run build` | build time — baked into the browser bundle |
| `Quality/frontend/.env.runtime` | PM2 → wrangler (app) | every start/restart |
| `Quality/backend/.env` | PM2 → node (middleware) | every start/restart |
| `Quality/supabase/.env` | Docker Compose | `docker compose up` |

Templates live in `deploy/quality/`.

---

## The build-time vs runtime rule

- `VITE_*` variables are **inlined into JavaScript at build time**. They are
  public — anyone can read them in the browser. Changing one requires a
  **rebuild + redeploy**; `pm2 restart` does nothing.
- Non-`VITE_` variables are read by server code at runtime through
  `process.env`. Changing one requires only
  `pm2 restart <app> --update-env`.
- Therefore: **never** put a secret behind a `VITE_` prefix. In particular
  `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely.

---

## 1. `Quality/frontend/.env.build`

```ini
VITE_SUPABASE_URL=https://api-quality.example.com
VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>
VITE_SUPABASE_PROJECT_ID=resl-quality
```

| Variable | Purpose | Sensitive |
|---|---|---|
| `VITE_SUPABASE_URL` | public Supabase gateway URL the browser calls | no |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | anon key; RLS still applies | no (public by design) |
| `VITE_SUPABASE_PROJECT_ID` | label used in generated types/logs | no |

## 2. `Quality/frontend/.env.runtime`

```ini
NODE_ENV=production
PORT=3000

SUPABASE_URL=https://api-quality.example.com
SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>
SUPABASE_ANON_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>

MIDDLEWARE_SHARED_SECRET=<shared with the middleware>

VAPID_PUBLIC_KEY=<web-push public key>
VAPID_PRIVATE_KEY=<web-push private key>
VAPID_SUBJECT=mailto:no-reply@example.com
```

| Variable | Purpose | Sensitive |
|---|---|---|
| `SUPABASE_URL` | server-side Supabase base URL | no |
| `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_ANON_KEY` | server calls acting as the signed-in user | no |
| `SUPABASE_SERVICE_ROLE_KEY` | privileged admin operations, bypasses RLS | **yes — highest** |
| `MIDDLEWARE_SHARED_SECRET` | authenticates middleware ↔ app callbacks | **yes** |
| `VAPID_*` | web-push notification signing | private key: **yes** |

## 3. `Quality/backend/.env`

See guide 07 for the full annotated version.

| Variable | Purpose | Sensitive |
|---|---|---|
| `PORT` | 3005 for Quality | no |
| `MIDDLEWARE_SHARED_SECRET` | must equal the app's value and the value in Admin → SAP API Settings | **yes** |
| `APP_BASE_URL` | where the middleware fetches config and posts logs | no |
| `SAP_REQUEST_TIMEOUT_MS` | 300000 — long SAP reports | no |
| `SAP_CONNECT/HEADERS/BODY_TIMEOUT_MS` | 60000 each | no |
| `MIDDLEWARE_MOCK` | `1` only for offline smoke tests | no |
| `SAP_BP_USERNAME` / `SAP_BP_PASSWORD` | fallback SAP credentials | **yes** |

## 4. `Quality/supabase/.env`

Full list in guide 05. Sensitive values: `POSTGRES_PASSWORD`, `JWT_SECRET`,
`SERVICE_ROLE_KEY`, `SECRET_KEY_BASE`, `VAULT_ENC_KEY`, `DASHBOARD_PASSWORD`,
`SMTP_PASS`, both `LOGFLARE_*` tokens.

---

## Values that must match across files

| Value | Appears in |
|---|---|
| `ANON_KEY` | supabase `.env`, frontend `.env.build`, frontend `.env.runtime` |
| `SERVICE_ROLE_KEY` | supabase `.env`, frontend `.env.runtime` |
| `MIDDLEWARE_SHARED_SECRET` | frontend `.env.runtime`, backend `.env`, Admin → SAP API Settings row |
| Supabase public URL | supabase `.env` (`API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL`), both frontend files, Nginx `server_name` |
| App public URL | supabase `.env` (`SITE_URL`), backend `.env` (`APP_BASE_URL`), Nginx `server_name` |
| Upload limit 50 MB | supabase `FILE_SIZE_LIMIT`, Nginx `client_max_body_size` |
| Timeout 300 s | backend `SAP_REQUEST_TIMEOUT_MS`, Nginx `proxy_read_timeout` on all three sites |

## Security practices

```bash
chmod 600 /data/webapplication/resl_approval/Quality/*/.env*
chown deploy:deploy /data/webapplication/resl_approval/Quality/*/.env*
```

- Back up env files **separately** from database dumps, encrypted:
  `gpg -c env-backup.tar`.
- Rotating `MIDDLEWARE_SHARED_SECRET`: update all three places, then
  `pm2 restart resl-quality-app resl-quality-mw --update-env`.
- Rotating `JWT_SECRET` invalidates `ANON_KEY` and `SERVICE_ROLE_KEY` — you
  must re-mint both, rebuild the frontend, and restart everything.
- Never `echo` a secret into a shell that logs history; use `read -s`.

## Verification

```bash
ls -l /data/webapplication/resl_approval/Quality/*/.env*     # -rw------- deploy deploy
# The service role key must NOT be in the browser bundle:
grep -rl "$(grep SERVICE_ROLE /data/webapplication/resl_approval/Quality/frontend/.env.runtime | cut -d= -f2)" \
  /data/webapplication/resl_approval/Quality/frontend/current/dist/client || echo "clean"
```

Next: [12 — Deployment Process](./12-deployment-process.md)
