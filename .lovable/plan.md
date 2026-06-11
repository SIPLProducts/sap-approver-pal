
## What's wrong

The Price Approvals "Execute" button calls a server function that runs on **Lovable Cloud (Cloudflare Workers)**. That function tries to `fetch()` the SAP endpoint directly:

```
http://10.150.150.154:8103/sd_approval_mng/zvk11_app/vk11_app?sap-client=300
```

`10.150.150.154` is a **private LAN IP**. Cloudflare Workers blocks direct connections to private IPs and returns **`403 Forbidden, error code: 1003`** in ~1ms. The 403 is from Cloudflare's edge, not from SAP — that's why no SAP auth log entry was created and latency is 1ms.

Your local middleware was built precisely for this case (it CAN reach the SAP LAN host), but the `Price_Approval_Fetch` config is currently:

- `auth_type = basic`
- `middleware_url = NULL`
- `proxy_secret_ref = NULL`

…so the cloud bypasses your middleware entirely.

You confirmed you're already running ngrok against the middleware. Plan: switch this config to **proxy mode** through your ngrok URL, and make the existing middleware actually serve the price-fetch call.

## Changes

### 1. Admin DB update (one row)
Migration that flips the config to proxy mode:
```sql
UPDATE public.sap_api_configs
SET auth_type        = 'proxy',
    middleware_url   = '<your-ngrok-https-url>',   -- e.g. https://abc123.ngrok-free.app
    proxy_secret_ref = 'MIDDLEWARE_SHARED_SECRET'
WHERE name = 'Price_Approval_Fetch';
```
(You'll paste the current ngrok URL when we go to build mode. Re-run this whenever ngrok rotates.)

### 2. Server function — `src/lib/sd/price-approval.functions.ts`
Today's proxy branch sends a GET with `?upstream=...` query string. The new middleware doesn't have an `/upstream` passthrough — it expects POST `/sap/run` with `{ configId, params }`. Rewrite the proxy branch to:

- POST to `${middleware_url}/sap/run`
- Body: `{ configId: cfg.id, params: { PLANT, USER_ID } }`
- Header: `x-shared-secret: process.env.MIDDLEWARE_SHARED_SECRET`
- Parse the same `DATA[]` shape from the response

The basic-auth branch stays as a fallback for SAP endpoints that ARE publicly reachable.

### 3. Middleware — `middleware/server.js`
Add a `POST /sap/run` endpoint:

1. Verify `x-shared-secret`.
2. `appFetch('/api/public/middleware/config', { configId })` to load endpoint + creds (already implemented).
3. Build URL: `endpoint_url + (& or ?)` + `PLANT=...&USER_ID=...`.
4. `fetch()` SAP with Basic auth from credentials (using existing keepAlive + timeouts).
5. Return `{ ok, status, body }` JSON to the cloud caller.
6. Log via `appFetch('/api/public/middleware/log', ...)`.

### 4. No UI changes
The Price Approvals page already shows the error toast and uses the same server fn — once the call succeeds, rows will populate normally.

## Operational notes

- **ngrok URL changes every restart** on the free plan. Each time it rotates, update the config (Admin → SAP API → Price_Approval_Fetch → Middleware URL). I'll add a small note to the admin page if useful.
- **Secret must match**: `MIDDLEWARE_SHARED_SECRET` in your local `middleware/.env` must equal the Lovable Cloud secret (already set to `123456`).
- This same proxy mode will work for any other SAP API that targets a private IP — just set `auth_type=proxy` + `middleware_url` on those configs too.

## Verification

After the changes:
1. Restart `node server.js` locally.
2. Confirm ngrok is forwarding to port 3005 over HTTPS.
3. In the app: Plant `3806` → Execute. Expect rows (or a real SAP error message with `latency_ms > 100ms`, proving the request hit SAP through your machine).
4. Check `sap_api_sync_log` — a new entry with `status='ok'` and a non-trivial latency confirms the round-trip.
