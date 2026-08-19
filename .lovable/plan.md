# The 401 is the placeholder, not a broken stack

You sent the literal text `<PRODUCTION_ANON_KEY>` as the API key, so Kong correctly answered
`401 Unauthorized`. Kong is healthy — it responded in 1 ms with a request id. Nothing is wrong with
Production; the command just needs the real key substituted.

## Run it with the actual key

Read `ANON_KEY` straight out of the Production backend `.env` so nothing is typed by hand:

```bash
cd /data/webapplication/resl_approval/Production/backend

ANON=$(grep -E '^ANON_KEY=' .env | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '[:space:]')
echo "key length: ${#ANON}"      # expect several hundred characters, not 0

curl -s -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  "http://127.0.0.1:8010/rest/v1/sap_api_configs?select=name&limit=5"
```

Notes on that command:

- `apikey` gets the request past Kong; `Authorization: Bearer` is what PostgREST uses to resolve the
  role, so send both.
- If `key length: 0`, the `.env` has no `ANON_KEY` line and the key still has to be minted from
  Production's `JWT_SECRET`.

Expected outcomes:

- `[]` — the gateway, PostgREST and the database all work; the anon role simply has no SELECT policy on
  that table. This is correct and expected, because `sap_api_configs` is admin-only by design.
- `{"message":"No API key found in request"}` — the header did not reach Kong; check the variable.
- `{"message":"Unauthorized"}` again — the key does not match Production's `JWT_SECRET`, so it must be
  re-minted from that secret.

## The check that actually matters

REST is gated by RLS, so it is a poor way to confirm the seed loaded. Query the database directly:

```bash
docker exec -i supabase-prod-db psql -U postgres -d postgres -c \
  "select
     (select count(*) from public.sap_api_configs)         as endpoints,
     (select count(*) from public.sap_api_request_fields)  as req_fields,
     (select count(*) from public.sap_api_response_fields) as resp_fields,
     (select count(*) from public.custom_roles)            as roles,
     (select count(*) from public.role_permissions)        as perms,
     (select count(*) from public.approval_strategies)     as strategies;"

docker exec -i supabase-prod-db psql -U postgres -d postgres -c \
  "select name, module, http_method, endpoint_url, auth_type, is_active
     from public.sap_api_configs where name = 'Login_API';"
```

Targets: 47 / 406 / 755 / 8 / 397 / 17, and exactly one `Login_API` row pointing at
`/sd_approval_mng/login/login?sap-client=300`.

If those counts are 0, the seed has not been applied yet:

```bash
cd /data/webapplication/resl_approval/Production/scripts
docker exec -i supabase-prod-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < quality-seed-data.sql
```

Use `quality-seed-data.sql` — it is the only variant that contains the `Login_API` endpoint row.

## Then verify through the app, not through anon REST

`sap_api_configs` is readable only by an authenticated Admin, which is why anon REST returns nothing
useful. Sign in at `http://10.150.150.130:9091/login` and open **Admin → SAP API Settings**; all 47
endpoints including `Login_API` should be listed there.

Remaining step before login works: set the Production SAP connection and middleware secret
(`middleware_url = http://127.0.0.1:3010`, port 3010, proxy secret matching Production's middleware
`.env`) either via `quality-sap-config.sql` or in that same Admin screen.

No application code changes are required.
