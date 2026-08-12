# Fix login: "Invalid or missing x-shared-secret" (HTTP 500)

## What is actually happening

The failing check is **the app rejecting the middleware**, not the middleware rejecting the app.

```text
Browser -> App :8080  sapLogin
        -> Middleware :3002  POST /login/Login_API      <- this call SUCCEEDS
              Middleware then calls back to the app:
        -> App :8081  POST /api/public/middleware/config <- this call returns 401
              "Invalid or missing x-shared-secret"
           Middleware turns that into a 500 and returns it to the app
Browser sees: status 500, error "Invalid or missing x-shared-secret"
```

Evidence: the login response shows `status: 500`. If the middleware had rejected the app's header, the app returns the message *"Middleware rejected the shared secret"* with 401 instead. The literal string `Invalid or missing x-shared-secret` with a 500 can only come from `src/routes/api/public/middleware/config.ts`, which compares the incoming header against the app server's own `MIDDLEWARE_SHARED_SECRET` environment variable.

So the mismatch is:

- middleware `.env`: `MIDDLEWARE_SHARED_SECRET=123456` (sends this header)
- app server `.env.runtime` / `frontend/.env`: `MIDDLEWARE_SHARED_SECRET` = something **other than** `123456` (or blank)

The database `proxy_secret` is already correct — that is why the first hop (app -> middleware) worked.

## The fix (no code changes needed)

1. On the quality server, set the app server's env value to match the middleware:

   ```bash
   cd /data/webapplication/resl_approval/Quality/frontend
   grep -n 'MIDDLEWARE_SHARED_SECRET' .env
   ```

   Make the line read exactly:

   ```text
   MIDDLEWARE_SHARED_SECRET=123456
   ```

2. Redeploy so `.env.runtime` is refreshed from `.env` and pm2 restarts with the new value:

   ```bash
   cd /data/webapplication/resl_approval/Quality/frontend/dist
   bash deploy-frontend.sh
   ```

3. Prove the handshake directly before touching the browser:

   ```bash
   curl -sS -i -X POST http://10.150.150.130:8081/api/public/middleware/config \
     -H 'Content-Type: application/json' \
     -H 'x-shared-secret: 123456' \
     -d '{"name":"Login_API"}'
   ```

   Expected: `HTTP/1.1 200` with `"ok":true` and a non-null `endpoint_url`.
   If it still returns 401, the app process is not seeing the value — check
   `grep MIDDLEWARE_SHARED_SECRET .env.runtime` inside `dist/`.

4. Then test login again at `http://10.150.150.130:8081/login`.

## Also worth aligning while we are here

- `SAP_BP_USERNAME` / `SAP_BP_PASSWORD` in the middleware `.env` are only fallbacks. The real SAP Basic-auth credentials come from the database rows `sap_global_settings.sap_username` and `sap_global_secrets.sap_password`. If SAP later returns an HTML login page, that pair is what to fix.
- Keep `middleware_url` in `sap_global_settings` pointing at `http://127.0.0.1:3002`, matching `PORT=3002`.

## Security note

`123456` is not a safe shared secret for a real environment. Once login works, replace it with a long random string in three places at once — middleware `.env`, the app's `.env`, and `sap_global_secrets.proxy_secret` — then redeploy both.

## Outcome

The middleware will be able to load the `Login_API` config from the app, the login call will complete against SAP, and any remaining error will be a genuine SAP message rather than a secret-handshake failure.
