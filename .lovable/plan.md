# Fix the deploy script's "keys missing" stop, then bring 8080 up

The values you pasted are correct — `SUPABASE_SERVICE_ROLE_KEY` really does decode to
`"role":"service_role"`, and all four required keys are present. So the script's
verdict at step 3 is wrong about *your* file, which means the file it read is not the
one you pasted, or the text has characters the check does not tolerate (BOM, CRLF,
leading spaces, `export ` prefix, quotes, a trailing space as on
`MIDDLEWARE_SHARED_SECRET=123456 `).

## Step 1 — one command to prove which it is

```bash
cd /data/webapplication/resl_approval/Quality/frontend
ls -l .env; file .env
grep -nE '^\s*(export\s+)?(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|MIDDLEWARE_URL|MIDDLEWARE_SHARED_SECRET)=' .env | cut -c1-60
```

`file` tells us CRLF/BOM; the `grep` tells us whether the keys are really in *this*
file (paste output back if it looks odd).

## Step 2 — the exact file to write

`/data/webapplication/resl_approval/Quality/frontend/.env`, LF endings, no quotes, no
trailing spaces:

```ini
VITE_SUPABASE_URL=http://10.150.150.130:8000
VITE_SUPABASE_PUBLISHABLE_KEY=<your anon key>
VITE_SUPABASE_PROJECT_ID=Quality

SUPABASE_URL=http://10.150.150.130:8000
SUPABASE_PUBLISHABLE_KEY=<your anon key>
SUPABASE_SERVICE_ROLE_KEY=<your service_role key>
MIDDLEWARE_URL=http://127.0.0.1:3002
MIDDLEWARE_SHARED_SECRET=123456

PORT=8080
HOST=127.0.0.1
NODE_ENV=production
```

Then `chmod 600 .env` and, to be safe about invisible characters:
`sed -i '1s/^\xEF\xBB\xBF//; s/\r$//; s/[ \t]*$//' .env`

Note the `VITE_*` values are only used at build time (they are baked into `dist/`);
the four unprefixed ones are what the server on 8080 reads at start.

## Step 3 — script change I will make (so this stops happening)

`scripts/deploy-frontend.sh`, step 3 only:

- strip a UTF-8 BOM, CR characters, an optional `export ` prefix, surrounding quotes
  and trailing whitespace while generating `.env.runtime`;
- match keys with `^[[:space:]]*(export[[:space:]]+)?KEY=` instead of a strict `^KEY=`;
- on failure, print the key names actually found in the file (names only, never
  values) plus the ready-to-paste template above, so the message says what is wrong
  rather than only what is missing;
- keep the service-role sanity check and everything from step 4 onward untouched.

`DEPLOY-QUALITY.md` gets a short "502 on /_serverFn — nothing on 8080" section with
the same template and the verification commands.

No application code, nginx, Docker, database or middleware changes.

## Step 4 — run and verify

```bash
cd /data/webapplication/resl_approval/Quality/frontend/dist
bash deploy-frontend.sh
pm2 save && pm2 startup
```

```bash
ss -lntp | grep ':8080'                        # a node process must appear
curl -I http://127.0.0.1:8080/                 # 200
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  http://127.0.0.1:8080/api/public/middleware/config    # 401 = alive, env visible
curl -I http://10.150.150.130:8081/            # 200 through nginx
curl -s http://127.0.0.1:3002/__health         # middleware OK
```

If 8080 answers directly but nginx still 502s, nginx is missing the `/_serverFn/` and
`/api/` proxy blocks to `127.0.0.1:8080` (`DEPLOY-QUALITY.md` section 3).

## One security note

`MIDDLEWARE_SHARED_SECRET=123456` is guessable. Once login works, replace it with a
long random value in both `frontend/.env` and `middleware/.env`, and rotate the
service-role key you pasted in chat.
