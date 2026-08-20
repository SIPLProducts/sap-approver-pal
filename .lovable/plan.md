# Fix Production REST 401 (Kong does not know this anon key)

## What the output proves

- Seed data landed correctly: 47 endpoints, 406 request fields, 755 response fields, 8 roles, 397 permissions, 34 strategies, and `Login_API` is present and active.
- `/auth/v1/health` returns 200 — but that route has **no key check**, so it proves nothing about the key.
- `/rest/v1/...` returns **401 from Kong**, not from PostgREST. Kong's `key-auth` plugin only accepts keys registered as consumer credentials from `SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY` at container start. So the running Kong was started with a **different** `ANON_KEY` than the one you pasted.

## Step 1 — See which key Kong is actually running with

```bash
cd /data/webapplication/resl_approval/Production/backend
grep -E '^(ANON_KEY|SERVICE_ROLE_KEY|JWT_SECRET)=' .env
docker exec supabase-prod-kong env | grep -E 'SUPABASE_ANON_KEY|SUPABASE_SERVICE_KEY'
```

Compare the value Kong holds with your key:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg3MTI5NjQ4LCJleHAiOjIxMDI0ODk2NDh9.lKrEgssvFYmKLqZPaOLOsV5qMSU1BrlLKt7H5KOcwZY
```

Two possible outcomes:

- **Kong holds a different key** → decide which key is canonical (Step 2A).
- **Kong holds this exact key but REST still 401s** → Kong wasn't reloaded after the `.env` change; recreate it (Step 3).

## Step 2A — Make this key canonical

Only valid if this key's signature verifies against the Production `JWT_SECRET` (PostgREST/GoTrue validate the signature; Kong only string-matches). Verify:

```bash
JWT_SECRET=$(grep -E '^JWT_SECRET=' .env | cut -d= -f2-)
python3 - "$JWT_SECRET" <<'PY'
import base64,hashlib,hmac,sys,json
sec=sys.argv[1].encode()
tok="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg3MTI5NjQ4LCJleHAiOjIxMDI0ODk2NDh9.lKrEgssvFYmKLqZPaOLOsV5qMSU1BrlLKt7H5KOcwZY"
h,p,s=tok.split(".")
def b64(x): return base64.urlsafe_b64encode(x).decode().rstrip("=")
print("payload:", json.loads(base64.urlsafe_b64decode(p+"==")))
print("signature valid:", b64(hmac.new(sec,f"{h}.{p}".encode(),hashlib.sha256).digest())==s)
PY
```

- **valid: True** → set `ANON_KEY=` to this key in `Production/backend/.env` and go to Step 3.
- **valid: False** → this key belongs to a different `JWT_SECRET`. Either keep the key already in `.env` (simpler — use it everywhere in the frontend), or mint a fresh anon + service key from the Production `JWT_SECRET`.

## Step 2B — Mint keys from the Production JWT_SECRET (only if Step 2A said False and you want new keys)

```bash
mint() { # $1=role
  H=$(printf '{"alg":"HS256","typ":"JWT"}' | openssl base64 -A | tr '+/' '-_' | tr -d '=')
  P=$(printf '{"role":"%s","iss":"supabase","iat":1787129648,"exp":2102489648}' "$1" \
      | openssl base64 -A | tr '+/' '-_' | tr -d '=')
  S=$(printf '%s.%s' "$H" "$P" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary \
      | openssl base64 -A | tr '+/' '-_' | tr -d '=')
  printf '%s.%s.%s\n' "$H" "$P" "$S"
}
echo "ANON_KEY=$(mint anon)"
echo "SERVICE_ROLE_KEY=$(mint service_role)"
```

Paste both into `Production/backend/.env`.

## Step 3 — Recreate the gateway so the credentials reload

Kong builds its consumer keyauth list at startup from the env, so a restart alone is not enough — recreate it:

```bash
cd /data/webapplication/resl_approval/Production/backend
docker compose -p resl_production --env-file .env up -d --force-recreate kong
docker compose -p resl_production --env-file .env up -d rest auth
```

Retest (expect `200`):

```bash
ANON=$(grep -E '^ANON_KEY=' .env | cut -d= -f2-)
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  "http://127.0.0.1:8010/rest/v1/sap_api_configs?select=name&limit=1"
```

An empty `[]` with 200 is also correct — `sap_api_configs` is Admin-only under RLS, so anonymous reads return no rows. The 200 is what matters.

## Step 4 — Use the same key in the Production frontend

`Production/frontend/.env` (then rebuild so the key is embedded in the client bundle):

```
VITE_SUPABASE_URL=http://10.150.150.130:8010
VITE_SUPABASE_PUBLISHABLE_KEY=<the ANON_KEY now in backend/.env>
SUPABASE_URL=http://10.150.150.130:8010
SUPABASE_PUBLISHABLE_KEY=<same>
SUPABASE_ANON_KEY=<same>
SUPABASE_SERVICE_ROLE_KEY=<Production service_role key>
MIDDLEWARE_URL=http://127.0.0.1:3010
MIDDLEWARE_SHARED_SECRET=<Production proxy secret>
PORT=8090
HOST=127.0.0.1
NODE_ENV=production
```

A mismatch here is what produces the "Missing Supabase environment variable" and "Unauthorized: Invalid token" errors you saw earlier.

## Step 5 — Production SAP settings, then first login

Set middleware port 3010, the Production proxy secret, and SAP base URL/credentials — either via Admin → SAP API Settings after the first Admin login, or by adapting `scripts/quality-sap-config.sql` with Production values and applying it:

```bash
docker exec -i supabase-prod-db psql -U postgres -d postgres < prod-sap-config.sql
```

`sap_global_secrets.proxy_secret` must equal `MIDDLEWARE_SHARED_SECRET` in both the frontend `.env` and the middleware `.env`, or login fails with "Middleware rejected the shared secret".
