# Fix the 502: fill in frontend/.env, then start the app server on 8080

The deploy script got as far as step 3 and stopped for one reason: the four keys the
app server needs are missing (or empty) in
`/data/webapplication/resl_approval/Quality/frontend/.env`. Until they exist, the
server on 8080 cannot start, so nginx on 8081 returns 502 for every `/_serverFn/*`
and `/api/*` call — which is the whole login path.

## Why the app server is required for login

```text
browser (8081) -> nginx -> app server 127.0.0.1:8080  (server functions)
                                |
                                +-> SAP middleware 127.0.0.1:3002 -> SAP
                                +-> Supabase / Kong 127.0.0.1:8000
```

The app server holds the service-role key and the middleware shared secret, creates
the session and relays SAP calls. Static files alone cannot log anyone in.

## Step 1 — collect the four values on the server

```bash
grep -E '^(ANON_KEY|SERVICE_ROLE_KEY)=' /data/webapplication/resl_approval/Quality/supabase/.env
grep -E '^SHARED_SECRET|^MIDDLEWARE_SHARED_SECRET' /data/webapplication/resl_approval/Quality/middleware/.env
```

(adjust the two paths if the supabase / middleware folders sit elsewhere).

## Step 2 — write frontend/.env

`nano /data/webapplication/resl_approval/Quality/frontend/.env`

```ini
SUPABASE_URL=http://127.0.0.1:8000
SUPABASE_PUBLISHABLE_KEY=<ANON_KEY from supabase/.env>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from supabase/.env — not the anon key>
MIDDLEWARE_URL=http://127.0.0.1:3002
MIDDLEWARE_SHARED_SECRET=<exact value from middleware/.env>

VITE_SUPABASE_URL=http://10.150.150.130:8081/supabase
VITE_SUPABASE_PUBLISHABLE_KEY=<same ANON_KEY>
PORT=8080
HOST=127.0.0.1
NODE_ENV=production
```

Notes that make this fail silently if ignored: no quotes and no trailing spaces, the
file must be LF (not CRLF), and the service-role slot must really be the service key
— the launcher decodes it and prints `holds a 'anon' key` when it is wrong, in which
case sessions can never be created.

Then `chmod 600` the file.

## Step 3 — run the deploy script again

```bash
cd /data/webapplication/resl_approval/Quality/frontend/dist
bash deploy-frontend.sh
pm2 save && pm2 startup
```

It regenerates `.env.runtime` from `frontend/.env`, restarts pm2 `Qty_App` on 8080
and runs its own checks. It never touches the middleware on 3002.

## Step 4 — verify, in this order

```bash
ss -lntp | grep ':8080'                        # a node process must appear
curl -I http://127.0.0.1:8080/                 # 200
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  http://127.0.0.1:8080/api/public/middleware/config    # 401 = alive, env visible
curl -I http://10.150.150.130:8081/            # 200 through nginx
curl -s http://127.0.0.1:3002/__health         # middleware OK
```

If 8080 answers directly but nginx still 502s, nginx is missing the `/_serverFn/`
and `/api/` proxy blocks to `127.0.0.1:8080` (both are in `DEPLOY-QUALITY.md`
section 3). If pm2 restarts in a loop: `pm2 logs Qty_App --lines 50`.

## Repo work in this plan

Documentation and script ergonomics only — no application code changes:

- `DEPLOY-QUALITY.md` gains a "502 on /_serverFn — nothing on 8080" section with the
  exact `frontend/.env` template above and the verification commands.
- `scripts/deploy-frontend.sh`: when a key is missing, print the ready-to-paste
  template block and the two `grep` commands that locate the values, instead of only
  naming the keys.
