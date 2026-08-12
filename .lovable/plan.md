# Why the data is in the database but the screens are empty

Your 4th screenshot is the proof that the data is fine: `public.sap_api_configs` shows **47 records**. So nothing is wrong with the seed, the tables, or the SQL you ran.

The screens are empty for a different reason. Every admin screen (APIs list, SAP Connection, Middleware Configuration, Users & Roles) is served by a server function that first validates your session token on the app server. That validation is failing, so the function never gets to the query and returns **"Unauthorized: Invalid token"** — which the UI shows as an empty list or a save error.

Screenshot 2 confirms the browser IS sending a proper `Authorization: Bearer …` header, and screenshot 3 confirms the server's answer is `Unauthorized: Invalid token`. So the token is sent and the *server side* rejects it.

Why the server rejects a valid token: to validate it, the app server calls your self-hosted backend using `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` from `dist/.env.runtime`. Your own checks on the server printed:

```text
awk -F. '{print NF}' <<<"$SUPABASE_PUBLISHABLE_KEY"   ->  5
curl .../auth/v1/health                               ->  401
curl -H "apikey: $KEY" .../rest/v1/                   ->  401
```

A valid key has **3** dot-separated parts. Yours has **5** — the anon key is pasted twice into one line. So every validation call the app server makes is rejected, and that surfaces as "Invalid token". Login still works because login is a public call that does not go through this validation.

So: database good, browser good, **one malformed line in the environment file** is the whole failure.

## Fix on the server (do this first — no code change needed)

Rebuild `frontend/.env` with commands instead of pasting, so long tokens cannot wrap or double:

```bash
cd /data/webapplication/resl_approval/Quality/frontend
cp .env .env.bak.$(date +%s)
SB=/data/webapplication/resl_approval/Quality/supabase/.env   # adjust if your path differs

ANON="$(grep -m1 '^ANON_KEY=' "$SB" | cut -d= -f2- | tr -d '\r\n "')"
SRV="$(grep -m1 '^SERVICE_ROLE_KEY=' "$SB" | cut -d= -f2- | tr -d '\r\n "')"
awk -F. '{print NF}' <<<"$ANON"   # must print 3
awk -F. '{print NF}' <<<"$SRV"    # must print 3

grep -vE '^(SUPABASE_URL|SUPABASE_ANON_KEY|SUPABASE_PUBLISHABLE_KEY|SUPABASE_SERVICE_ROLE_KEY|VITE_SUPABASE_URL|VITE_SUPABASE_PUBLISHABLE_KEY|MIDDLEWARE_URL|MIDDLEWARE_SHARED_SECRET)=' .env > .env.new
{
  echo "SUPABASE_URL=http://10.150.150.130:8000"
  echo "SUPABASE_ANON_KEY=$ANON"
  echo "SUPABASE_PUBLISHABLE_KEY=$ANON"
  echo "SUPABASE_SERVICE_ROLE_KEY=$SRV"
  echo "VITE_SUPABASE_URL=http://10.150.150.130:8000"
  echo "VITE_SUPABASE_PUBLISHABLE_KEY=$ANON"
  echo "MIDDLEWARE_URL=http://127.0.0.1:3002"
  echo "MIDDLEWARE_SHARED_SECRET=123456"
} >> .env.new
mv .env.new .env && chmod 600 .env

# must print 8
grep -cE '^(SUPABASE_URL|SUPABASE_ANON_KEY|SUPABASE_PUBLISHABLE_KEY|SUPABASE_SERVICE_ROLE_KEY|VITE_SUPABASE_URL|VITE_SUPABASE_PUBLISHABLE_KEY|MIDDLEWARE_URL|MIDDLEWARE_SHARED_SECRET)=.+' .env
```

Then redeploy and verify:

```bash
cd dist && bash deploy-frontend.sh
set -a; . ./.env.runtime; set +a
awk -F. '{print NF}' <<<"$SUPABASE_PUBLISHABLE_KEY"    # 3
awk -F. '{print NF}' <<<"$SUPABASE_SERVICE_ROLE_KEY"   # 3
curl -s -o /dev/null -w '%{http_code}\n' "$SUPABASE_URL/auth/v1/health"                                   # 200
curl -s -o /dev/null -w '%{http_code}\n' -H "apikey: $SUPABASE_PUBLISHABLE_KEY" "$SUPABASE_URL/rest/v1/"  # 200
```

Do not move on until you see `3`, `3`, `200`, `200`. Then sign out, sign in again, and open SAP API Settings — the 47 endpoints should appear, and saving SAP Connection / Middleware Configuration should succeed.

Important: the SAP Connection and Middleware Configuration tabs use the URL as the **app server** sees it, so keep `SUPABASE_URL` and `VITE_SUPABASE_URL` spelled identically (`10.150.150.130:8000`, not `127.0.0.1`), otherwise the token issuer and the validating host disagree.

### About the `.env.runtime` you just opened in nano

Three things about that file:

- `nano` truncates each long line on screen with a `>` at the right edge, so seeing `...EhhlW>` tells you nothing about whether the key is doubled. The only reliable check is `awk -F. '{print NF}'` — it must print `3`.
- `MIDDLEWARE_URL` appears **twice**; the second one wins. Harmless here since both are identical, but it is a sign the file was hand-edited.
- `SUPABASE_URL=http://127.0.0.1:8000` while the browser bundle was built with `10.150.150.130:8000`. Make both `10.150.150.130:8000`.

Most importantly: **editing `dist/.env.runtime` by hand is temporary** — `deploy-frontend.sh` regenerates it from `frontend/.env` on the next deploy and your edit disappears. Fix `frontend/.env` with the commands above; that is the file that survives.



## Code changes I will make so this cannot silently happen again

1. **Boot guard in the generated `dist/start.mjs`** (from `scripts/collect-dist.mjs`): validate each Supabase key is a 3-part JWT carrying the expected role (`anon` / `service_role`), and refuse to start with a message naming the offending variable. Names only, never values.
2. **Same validation at build time** in `scripts/collect-dist.mjs` when writing `.env.runtime`, plus a warning when `SUPABASE_URL` and `VITE_SUPABASE_URL` disagree on host.
3. **Precise auth errors** in `src/integrations/supabase/auth-middleware.ts`: replace the single `Unauthorized: Invalid token` with distinct causes — backend unreachable, apikey rejected, token expired, token valid but no subject — so the next occurrence names itself.
4. **Admin diagnostics panel** on the SAP API Settings page (admin-only, no secret values): backend host as the server sees it, auth health reachable yes/no, apikey accepted yes/no, presented bearer validates yes/no. Replaces the manual curl sequence above.
5. **Unblock the build.** The last build stopped at the packaging check in `scripts/verify-dist.mjs` with `dangling asset reference(s) — server/ and assets/ come from different builds`: `dist/index.html` still points at hashed files from a previous build. I will make the build clear `dist/`, `.output/` and `.wrangler/` before it writes anything, so `index.html` and `assets/` always come from the same run.

Nothing here touches the database, the seeded 47 endpoints, the middleware on 3002, or the login flow.

