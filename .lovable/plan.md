# Login on Quality: remaining blocker is the middleware shared secret

## Where things stand now (from your output)

- App server is finally up: `[start] serving app server on http://0.0.0.0:8080`. The earlier `start.mjs not found` lines are old log entries from before the folder was complete — ignore them.
- `Login_API` row exists and is active, pointing at `http://10.150.150.155:8005/sd_approval_mng/login/login?sap-client=300`.
- The middleware answers, but rejects the call: `{"ok":false,"error":"Invalid or missing x-shared-secret"}`. So `123456` is **not** the secret the middleware expects.
- The repeating `Unable to fetch the Request.cf object` / `TimeoutError` lines are harmless: the local runtime tries to reach Cloudflare for request metadata, has no internet, and falls back to a placeholder. They do not stop the server.

## The one thing that is still wrong

Three places must hold the **same** secret string, and today they don't:

1. `middleware/.env` -> `MIDDLEWARE_SHARED_SECRET` (the value the middleware actually checks)
2. `frontend/.env` -> `MIDDLEWARE_SHARED_SECRET` (baked into `dist/.env.runtime` at build time)
3. Database table `sap_global_secrets` -> `proxy_secret` (what the login server function sends as `x-shared-secret`)

The login code reads the secret from `sap_global_secrets.proxy_secret`, not from the environment file, so that row is mandatory even after the env file is right.

Read the real value first:

```bash
grep -m1 MIDDLEWARE_SHARED_SECRET /data/webapplication/resl_approval/Quality/middleware/.env
```

Then re-test with exactly that value (paste it literally, no shell variable — a stray carriage return in the variable produced the earlier 400):

```bash
curl -i -X POST http://127.0.0.1:3002/login/Login_API \
  -H 'content-type: application/json' -H 'x-shared-secret: <real value>' \
  -d '{"inputs":{"LOGIN":{"USER":"22011840","PASSWORD":"12345678"}}}'
```

Expect the SAP user JSON. If it still rejects, the middleware is running with an older environment — `pm2 restart Qty_Approval --update-env`.

## Database rows the login path still needs

`Login_API` is done. Two rows remain, both keyed `default`:

- `sap_global_settings`: `middleware_url` = `http://127.0.0.1:3002`, SAP base URL, SAP username, `connection_mode` = `via_proxy`, `deployment_mode` = `self_hosted`.
- `sap_global_secrets`: `proxy_secret` = the real middleware secret above, `sap_password` for SAP.

Without `middleware_url` the login function tries to reach SAP directly from the app server instead of going through your middleware.

## Implementation

1. Write one re-runnable seed migration inserting/updating those two `default` rows with the Quality values, satisfying the existing check constraints.
2. Add a request timeout to the middleware call in the login path so an unresponsive middleware returns a clear message instead of a pending request.
3. Quiet the startup noise: keep the launcher in offline mode and stop the reload loop so the log shows the single "serving app server" line rather than repeated Cloudflare timeouts.
4. Still fix `SUPABASE_SERVICE_ROLE_KEY` in `frontend/.env` — the value you pasted decodes to `"role":"anon"`, and the login function needs a true service-role key to create the backend session. Get it from the self-hosted stack:

```bash
grep -E '^SERVICE_ROLE_KEY=' /data/webapplication/resl_approval/Quality/supabase/.env
```

Rotate the keys and the secret pasted into chat once login works.

## Verification

After rebuilding, copying `dist/`, and `pm2 restart Qty_App --update-env`:

1. `curl -i http://127.0.0.1:8080/` returns the login page HTML.
2. The middleware `curl` above returns the SAP user JSON.
3. Signing in through `http://10.150.150.130:8081` completes instead of leaving `/_serverFn/...` pending.
