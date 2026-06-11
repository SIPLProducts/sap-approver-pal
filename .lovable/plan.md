## Which API is being hit (and why it fails)

When you click **Execute**, this chain runs:

```
Browser → Lovable server fn (price-approval)
        → ngrok → your local middleware (server.js)
        → middleware calls back to the app:
             POST {APP_BASE_URL}/api/public/middleware/config
          to load SAP URL + credentials
        → middleware calls SAP 10.150.150.154:8103
```

The error in your screenshot:

```
SAP returned 500 Internal Server Error:
{"ok":false,"error":"/api/public/middleware/config failed: HTTP 200"}
```

is thrown by `server.js → appFetch()` — **before** SAP is ever called. The "SAP returned 500" prefix in the UI is misleading; the real failure is the middleware → app callback.

## Root cause

Your `middleware/.env` has:

```
APP_BASE_URL=https://id-preview--06a5c0be-58b7-41a6-ac2d-e7706e765b64.lovable.app
```

That `id-preview--…` host is **auth-gated**. I just probed it from outside:

```
POST /api/public/middleware/config
HTTP/2 302
location: https://lovable.dev/auth-bridge?...
```

Your middleware (no browser cookies) follows the redirect, lands on the auth-bridge HTML page with status 200, `await res.json()` fails, `json.ok` is undefined → it throws `"… failed: HTTP 200"`.

The `/api/public/*` bypass only works on the **stable** preview/published hosts, not on `id-preview--…`.

## The fix (one-line config change, no code edits)

Update `middleware/.env` to use the stable preview host:

```
APP_BASE_URL=https://project--06a5c0be-58b7-41a6-ac2d-e7706e765b64-dev.lovable.app
```

I verified this host returns proper JSON for `/api/public/middleware/config` with no auth gate (it correctly returned `{"ok":false,"error":"Config not found: …"}` for a fake UUID).

Then:

1. Save `middleware/.env`
2. Restart: `node server.js`
3. In the app: Plant `3806` → **Execute**

You should now see either real SAP rows or a real SAP error with non-trivial latency in `sap_api_sync_log` — proving the request reached SAP through your machine.

## Optional code hardening (recommend doing this too)

To make this failure mode obvious in the future, I'll also update `middleware/server.js → appFetch()` so that when the app response isn't JSON (HTML auth page, etc.) the error message says **"APP_BASE_URL is auth-gated or wrong — got non-JSON response"** instead of the cryptic `"failed: HTTP 200"`. And update `middleware/README.md` + `.env.example` to call out that only `project--{id}-dev.lovable.app` / `project--{id}.lovable.app` work — never `id-preview--…`.

No DB changes, no app-side code changes needed.