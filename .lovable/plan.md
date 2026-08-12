# Fix "Unauthorized: Invalid token" on the Quality server

## What is actually happening

Login works because the login call is a public server function — it does not need a session. Every other screen (SAP API Settings list, Users & Roles, Release Strategies, Integrations) goes through an authenticated server function. Those calls do this:

```text
Browser  --Bearer <access_token from your local backend>-->  App server :8080
App server  --validates the token against SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY-->  backend
                                             <-- rejected  =>  "Unauthorized: Invalid token"
```

So the row data (your 47 APIs, SAP Connection, Middleware Configuration) may well be sitting in the database already — the app never gets to read it, because token validation fails first. This is one root cause behind both symptoms, not two problems.

The token is minted by the backend the **browser bundle** points at (the `VITE_SUPABASE_*` values baked in at build time). It is verified by the backend the **app server process** points at (`SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` in `dist/.env.runtime`). If those two are not the same instance, or the anon/publishable key does not belong to that instance's JWT secret, verification fails exactly like this.

## Checks to run on the Quality server (in order, stop at the first mismatch)

1. What the app server uses:
   ```bash
   grep -E 'SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY|SUPABASE_ANON_KEY' dist/.env.runtime
   ```
2. What the browser bundle uses — the built JS contains the URL literally:
   ```bash
   grep -ro 'https\?://[^"]*supabase[^"]*' dist/assets/*.js | sort -u
   grep -ro 'http://10\.150\.[^"]*' dist/assets/*.js | sort -u
   ```
   The host here must be the same backend as step 1.
3. Is that backend reachable from the app server, and does the key it holds work?
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' "$SUPABASE_URL/auth/v1/health"
   curl -s -o /dev/null -w '%{http_code}\n' -H "apikey: $SUPABASE_PUBLISHABLE_KEY" "$SUPABASE_URL/rest/v1/"
   ```
   401 on the second line = the publishable/anon key does not belong to this backend (regenerated JWT secret, or a key copied from a different project).
4. Prove it with your own live token. In the browser on the failing screen, open DevTools > Application > Local Storage, copy the `access_token` from the `sb-*-auth-token` entry, then on the server:
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' \
     -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
     -H "Authorization: Bearer <access_token>" \
     "$SUPABASE_URL/auth/v1/user"
   ```
   200 = tokens are fine and the problem is elsewhere. 401 = confirmed key/instance mismatch; that is the whole bug.

## Most likely fixes

- **Key mismatch (most common):** take the `ANON_KEY` and `SERVICE_ROLE_KEY` that were generated from the running stack's current `JWT_SECRET` and put them into `dist/.env.runtime` (`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), then `pm2 restart Qty_App --update-env`. If the backend's `JWT_SECRET` was changed after the keys were issued, all previously issued keys and sessions are invalid — re-issue keys and sign in again.
- **Two different backends:** rebuild the frontend with `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` pointing at the same local backend as the server-side values, then redeploy `dist`.
- **URL not reachable from the app server:** `SUPABASE_URL` must be an address the server process itself can reach (container name or host IP + port), not a browser-only address.

## What I would change in the code (small, optional but worth it)

1. Make the failure name itself instead of the generic string: the auth middleware currently collapses every case to `Unauthorized: Invalid token`. It will log/report which case it was — unreachable backend, rejected apikey, expired token, valid-but-no-subject — so this never costs another day of guessing.
2. Add a server-side diagnostics route (admin-only, no secrets in the output) returning: backend URL host as seen by the server, whether `/auth/v1/health` answers, whether the publishable key is accepted, and whether the presented bearer validates. One page instead of the four manual curl steps above.

## Technical notes

- Validation happens in `src/integrations/supabase/auth-middleware.ts` via `supabase.auth.getClaims(token)`; with a symmetric (HS256) local JWT secret this becomes a live call to the backend's auth service, so both reachability and apikey validity matter.
- `src/start.ts` already registers `attachSupabaseAuth`, so the browser is sending the bearer; the token is being rejected on the server side, not missing.
- No database migration is involved. Nothing about this needs the seed files re-run — verify the counts once auth works.
