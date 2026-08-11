# Confirmed diagnosis and fix: the app server, not the secret

## Your two secrets already match

`frontend/.env` and `middleware/.env` both hold `MIDDLEWARE_SHARED_SECRET=123456`. Nothing is mismatched, so no secret change is needed.

## Where the 401 actually comes from

The log line is `[/login/Login_API] failed Invalid or missing x-shared-secret`. In the middleware, that message is printed from inside the route's `try` block — after the shared-secret guard has already passed. The middleware accepted your app's header; the failure happens on the *next* hop:

```text
App server :8080  --(x-shared-secret: 123456)-->  middleware :3002   OK, accepted
middleware :3002  --(x-shared-secret: 123456)-->  APP_BASE_URL
                                                  /api/public/middleware/config
                                                  <-- 401 "Invalid or missing x-shared-secret"
```

That endpoint compares the header against `process.env.MIDDLEWARE_SHARED_SECRET` **inside the app**. The app is not running as a normal Node process — it runs inside the wrangler/miniflare worker sandbox, which does not inherit the launcher's environment. So inside the app that variable is undefined and every callback is rejected, no matter what is in your `.env`.

This is the same root cause as your other symptoms: the endless `Unable to fetch the Request.cf object` / `TimeoutError` / `Reloading local server...` loop and the resulting 502.

## The fix: run the app as a plain Node server

1. `vite.config.ts` gains a `SELF_HOST=1` branch that builds with the Node server preset instead of the Cloudflare worker preset. Lovable preview and publish are unaffected.
2. New `npm run build:selfhost` runs the same two passes and emits `dist/server/index.mjs` as a real Node HTTP server, plus `dist/index.html` and assets for nginx.
3. `dist/start.mjs` becomes a small wrapper: load `dist/.env.runtime` into `process.env`, then import the server. No wrangler, no `.runtime` install, no `--var` bindings, no Cloudflare calls. Every variable in `.env.runtime` is then genuinely visible to server code — including `MIDDLEWARE_SHARED_SECRET`, which fixes the 401 above.
4. The startup guard stays: refuse to boot when `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is empty, warn when the service-role slot holds an `anon` key, and log key names only.
5. The deployment handbook and PM2 config move to `node dist/start.mjs` on port 8080.

## One value in frontend/.env is still wrong

`SUPABASE_SERVICE_ROLE_KEY` currently holds the `anon` key (its payload reads `"role":"anon"` — same value as `SUPABASE_ANON_KEY`). Replace it with the `SERVICE_ROLE_KEY` line from `backend/.env`, whose payload reads `"role":"service_role"`. Without it, session creation and the SAP config lookup fail even after the server runs correctly.

## nginx must expose the app's own routes

`middleware/.env` has `APP_BASE_URL=http://10.150.150.130:8081`, i.e. the middleware calls back through nginx. That host must proxy both `/api/` and `/_serverFn/` to `127.0.0.1:8080`; if only `/` is served as static files, the config callback gets HTML and login fails. Verified in the handbook as part of this change.

## Complete flow once fixed

```text
Browser (nginx :8081)
  -> POST /_serverFn/... sapLogin                 nginx proxies to 127.0.0.1:8080
App server :8080 (plain Node, PM2 "Qty_App")
  -> reads Login_API + middleware URL from the database (service_role key)
  -> POST http://127.0.0.1:3002/login/Login_API   header x-shared-secret
Middleware :3002 (PM2 "Qty_Appr")
  -> POST http://10.150.150.130:8081/api/public/middleware/config
                                                  header x-shared-secret  (now accepted)
  -> resolves SAP URL + SAP credentials
  -> POST http://10.150.150.155:8005/...          SAP Login_API
SAP -> USER + PLANTS + roles + release keys
App server -> creates the session, stores the SAP profile
Browser -> signed in, lands on /inbox
```

## Server steps after the new dist is copied

```bash
pm2 restart Qty_App --update-env
pm2 restart Qty_Appr --update-env
pm2 logs Qty_App --lines 30 --nostream
```

Expected: no wrangler output, no anon-key warning, and the middleware's next log line is the SAP response instead of the shared-secret rejection.

`123456` is a weak shared secret; worth replacing with a long random value in both `.env` files once login works.
