# Production Backend Verification & Seeding

Use the Production anon key you provided in all API checks below. It is a publishable key (role `anon`), so it is safe to paste into shell commands.

## Step 1 — Verify the API gateway responds with your key

```bash
ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg3MTI5NjQ4LCJleHAiOjIxMDI0ODk2NDh9.lKrEgssvFYmKLqZPaOLOsV5qMSU1BrlLKt7H5KOcwZY'

# health (should be 200)
curl -i -H "apikey: $ANON" http://127.0.0.1:8010/auth/v1/health

# PostgREST reachable (200 with [] is OK — RLS hides admin-only rows)
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  "http://127.0.0.1:8010/rest/v1/sap_api_configs?select=name&limit=5"
```

If this returns 401, the key does not match the running stack's `JWT_SECRET` — the key must be minted from the same `JWT_SECRET` present in `Production/backend/.env`.

## Step 2 — Confirm the key matches the stack `.env`

```bash
cd /data/webapplication/resl_approval/Production/backend
grep -E '^(ANON_KEY|SERVICE_ROLE_KEY|JWT_SECRET)=' .env | cut -c1-40
```

`ANON_KEY` in `.env` must be byte-identical to the key above. If it differs, update `.env`, then:

```bash
docker compose -p resl_production --env-file .env up -d kong auth rest
```

## Step 3 — Verify the schema and seed data actually landed

REST is RLS-restricted, so count rows directly in Postgres:

```bash
docker exec -i supabase-prod-db psql -U postgres -d postgres -c \
  "select count(*) as configs from public.sap_api_configs;
   select count(*) as req_fields from public.sap_api_request_fields;
   select name from public.sap_api_configs order by name limit 20;"
```

`Login_API` must appear in that list. If `configs` is 0, load the seed:

```bash
docker exec -i supabase-prod-db psql -U postgres -d postgres \
  < /data/webapplication/resl_approval/Production/scripts/quality-seed-data.sql
```

## Step 4 — Point the frontend at Production

In the Production frontend `.env` (and rebuilt runtime env):

```
VITE_SUPABASE_URL=http://10.150.150.130:8010
VITE_SUPABASE_PUBLISHABLE_KEY=<the anon key above>
SUPABASE_URL=http://10.150.150.130:8010
SUPABASE_PUBLISHABLE_KEY=<the anon key above>
SUPABASE_ANON_KEY=<the anon key above>
```

Then rebuild and redeploy the frontend so the key is embedded in the client bundle.

## Step 5 — Production SAP settings

Set the Production middleware/SAP values (middleware port 3010, Production proxy secret, SAP user/password) either through the Admin UI after the first Admin login, or by adapting `scripts/quality-sap-config.sql` with Production values and running it via `docker exec ... psql`.

## Notes

- `MIDDLEWARE_SHARED_SECRET` in the frontend/server env must exactly equal the `proxy_secret` stored in `sap_global_secrets`, otherwise login fails with "Middleware rejected the shared secret".
- The service role key is never used from the browser; keep it only in `Production/backend/.env`.
