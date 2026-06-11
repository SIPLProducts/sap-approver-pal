## Problem

The value you pasted as `SUPABASE_SERVICE_ROLE_KEY` is actually the **anon/publishable** key (its JWT payload says `"role":"anon"`). On Lovable Cloud, the real service-role key is not exposed to users — so the middleware can't keep that key on your laptop.

If we just leave the anon key there, the middleware will start, but every query to `sap_api_configs` / `sap_api_credentials` / `sap_api_sync_log` will return 0 rows because those tables have RLS enabled with only `authenticated + Admin` policies. And we can't fix it by granting `anon` access to `sap_api_credentials` — it holds SAP passwords; the anon key is public (it's in your frontend bundle), so anyone could read those passwords.

## Solution: move the DB calls into the app (server route), keep the middleware DB-free

Instead of the middleware talking to the database directly, it will call a small **public server route in your Lovable app** that uses the admin client internally. The middleware only needs the shared secret. Your laptop holds no Supabase keys at all.

```text
SAP UI ──► middleware (your laptop, port 3005) ──► server route in app ──► Supabase (admin) ──► returns config
                       │
                       └───────────────────────────────► SAP (basic/oauth)
```

The middleware still owns: outbound SAP HTTP call, timeouts, basic/oauth header building, field mapping, response shaping. The app owns: reading `sap_api_configs` / `sap_api_credentials` / `sap_api_request_fields` / `sap_api_response_fields` and writing `sap_api_sync_log`.

## Changes

### 1. New server routes in the app (admin-only, gated by middleware shared secret)

Add `src/routes/api/public/middleware/config.ts` and `src/routes/api/public/middleware/log.ts`:

- `POST /api/public/middleware/config` → body `{ configId }`, header `x-shared-secret`. Uses `supabaseAdmin` to load the config + credentials + request/response fields and returns a single resolved JSON object (same shape `loadConfig` builds today). Returns 401 if the shared secret doesn't match `MIDDLEWARE_SHARED_SECRET` env on the app side.
- `POST /api/public/middleware/log` → body `{ configId, status, latency_ms, message }`. Inserts one row into `sap_api_sync_log`. Same shared-secret gate.

Both routes are under `/api/public/*` so they bypass auth gates, but they require the shared secret header. We verify with `timingSafeEqual`.

### 2. Add `MIDDLEWARE_SHARED_SECRET` as a Lovable Cloud secret

So the app-side routes can validate the header. (The middleware on your laptop already has the same value in its `.env`.)

### 3. Rewrite `middleware/server.js` to stop using Supabase directly

- Remove `@supabase/supabase-js`, remove `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` requirement.
- Add `APP_BASE_URL` env (e.g. `https://id-preview--06a5c0be-58b7-41a6-ac2d-e7706e765b64.lovable.app` for now; later the published URL).
- `loadConfig(configId)` → `POST {APP_BASE_URL}/api/public/middleware/config` with `x-shared-secret`.
- `writeLog(...)` → `POST {APP_BASE_URL}/api/public/middleware/log` with `x-shared-secret`.
- Keep `probeSap`, `invokeSap`, basic/oauth header build, timeouts, in-memory 30s config cache, oauth token cache exactly as they are.

### 4. Update `middleware/.env.example` + `middleware/README.md`

Remove `SUPABASE_*`. Add `APP_BASE_URL`. Keep `PORT`, `MIDDLEWARE_SHARED_SECRET`, timeout knobs, and the optional `SAP_BP_*` / `SAP_DMS_*` fallbacks.

### 5. (Optional) mock mode for offline smoke testing

Add `MIDDLEWARE_MOCK=1` — when set, `loadConfig` skips the app call entirely and builds a config from `SAP_BP_API_URL` + `SAP_BP_USERNAME` + `SAP_BP_PASSWORD` so you can verify SAP connectivity from your laptop without the app being reachable.

## Why this is the right shape on Lovable Cloud

- The service-role key never leaves Lovable Cloud (it can't — you don't have it).
- `sap_api_credentials` stays RLS-locked; SAP passwords are never readable by the anon key.
- The middleware stays a thin SAP proxy you can ship as a Windows service or container later, without bundling any database driver.
- Same model works in production: just change `APP_BASE_URL` to your published `project--<id>.lovable.app` URL.

## What I need from you before building

1. Confirm we go with this architecture (middleware → app route → DB), instead of granting `anon` direct read access to the SAP tables (which would leak credentials).
2. Confirm you want me to add `MIDDLEWARE_SHARED_SECRET` as a Lovable Cloud secret in the same step. Value will be `123456` to match your local `.env` — you can change it later via the secrets UI.
3. For `APP_BASE_URL` during local dev, OK to default to the current preview URL `https://id-preview--06a5c0be-58b7-41a6-ac2d-e7706e765b64.lovable.app`?
