# Fix: Price Approvals bypasses the middleware

## What's wrong

The error `Could not reach SAP at http://10.150.150.154:8103/...` means the cloud server is trying to hit the private SAP IP **directly**, instead of going through your ngrok middleware.

Why: `src/lib/sd/price-approval.functions.ts` decides whether to proxy by checking `cfg.auth_type === "proxy"` on the per-config row. But your config has:

- `sap_api_configs.auth_type = 'basic'` (per-row auth — correct, that's how SAP is authenticated)
- `sap_global_settings.connection_mode = 'via_proxy'` (global routing — says "send everything through middleware")
- `sap_global_settings.middleware_url = https://...ngrok...` ✓

The per-config `auth_type` and the global `connection_mode` are two different things, but the code only looks at `auth_type`. So the proxy branch is never taken and the Worker tries the private IP directly.

## Fix

In `src/lib/sd/price-approval.functions.ts`:

1. Also read `sap_global_settings` (connection_mode, middleware_url) and `sap_global_secrets` (proxy_secret).
2. Treat the request as proxied when **either**:
   - `cfg.auth_type === 'proxy'` (existing behavior), OR
   - global `connection_mode === 'via_proxy'` AND a `middleware_url` is set (new).
3. When proxied, POST to `{middleware_url}/sap/invoke` with `x-shared-secret: <global proxy_secret>` (fall back to `cfg.proxy_secret_ref` env / `MIDDLEWARE_SHARED_SECRET` like today). Body stays `{ configId, inputs: { PLANT, USER_ID } }`.
4. Middleware already loads the SAP creds via `/api/public/middleware/config` and calls SAP from your LAN — no middleware change needed.

No DB migration, no UI change. Only `price-approval.functions.ts` is edited.

## After the fix

Click Execute again. The request will go: Worker → ngrok → your middleware → SAP `10.150.150.154`. You should see a `POST /sap/invoke` hit in the middleware logs and rows back in the UI.
