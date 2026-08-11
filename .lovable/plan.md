# Fix missing backend environment variables on Quality

## Confirmed cause

The frontend and app server are reachable, which is why the branded error page appears instead of an Nginx 502.

The built `dist/.env.runtime` contains `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, and `start.mjs` reads that file. However, it only passes the values as operating-system environment variables to Wrangler. The Worker configuration in `dist/server/wrangler.json` has no variable bindings, so the running application cannot read them and reports:

```text
Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY
```

The current build artifact also has blank `SUPABASE_SERVICE_ROLE_KEY`, `MIDDLEWARE_URL`, and `MIDDLEWARE_SHARED_SECRET`; those must be populated with the Quality environment values before SAP login can complete.

## Review of the values you pasted

Correct as-is:

- `VITE_SUPABASE_URL` and `SUPABASE_URL` = `http://10.150.150.130:8000`
- `VITE_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_PUBLISHABLE_KEY` (both decode to `"role":"anon"`, which is right for these)
- `VITE_SUPABASE_PROJECT_ID=Quality`
- `MIDDLEWARE_URL=http://127.0.0.1:3002`
- `MIDDLEWARE_SHARED_SECRET=123456` — valid only if byte-identical to `middleware/.env`, otherwise the middleware answers `401 Invalid or missing x-shared-secret`

One line is wrong:

- `SUPABASE_SERVICE_ROLE_KEY` currently holds the same anon key. Its payload decodes to `"role":"anon"`, so it is not a service-role key. With it, privileged server work (session creation, SAP config lookup, sync-log writes) is refused by row-level security and login still fails — with a permissions error instead of the current one.

Replace only that line with the real service-role key from the self-hosted stack:

```bash
grep -E '^(ANON_KEY|SERVICE_ROLE_KEY)=' /data/webapplication/resl_approval/Quality/supabase/.env
```

Use the `SERVICE_ROLE_KEY` value; its payload must decode to `"role":"service_role"`. Also note the browser must reach `10.150.150.130:8000` directly with this configuration — if it cannot, the backend URL has to be the Nginx-exposed path instead.

Since these keys have now been pasted into chat, rotate them once login is confirmed working.

## Implementation

1. Update the generated `dist/start.mjs` launcher to explicitly expose the approved server variables to the local Worker runtime instead of relying on inherited process environment behavior.
2. Validate all login-critical values before starting port 8080:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `MIDDLEWARE_URL`
   - `MIDDLEWARE_SHARED_SECRET`
3. Reject a `SUPABASE_SERVICE_ROLE_KEY` whose payload is not `service_role`, with a clear startup message and no key material in the log — this exact mistake otherwise surfaces much later as a confusing permissions error.
4. Keep private values out of logs and error output; only print the names of offending variables.
5. Update the deployment helper to validate the publishable key as well, then restart `Qty_App` with the corrected runtime bindings.
6. Keep the existing architecture unchanged:

```text
Browser :8081 -> Nginx -> App server :8080 -> Middleware :3002 -> SAP
                                |
                                +-> Quality backend :8000
```

## Deployment after the change

On the development machine:

1. Put the corrected Quality values in the frontend `.env` (real service-role key).
2. Run `npm run build`.
3. Copy the complete new `dist/` to the Quality server.


On the Quality server:

```bash
cd /data/webapplication/resl_approval/Quality/frontend/dist
npm install --omit=dev --prefix .runtime
pm2 restart Qty_App --update-env
pm2 logs Qty_App --lines 50 --nostream
```

No middleware, Docker, database, SAP URL, or Nginx change is required for this specific error.

## Verification

```bash
curl -i http://127.0.0.1:8080/login
curl -i http://127.0.0.1:8081/login
ss -ltnp | grep ':8080'
```

Expected result: the login page renders without the missing-environment error. A login attempt then reaches `Qty_App`, followed by `Qty_Approval` on port 3002.