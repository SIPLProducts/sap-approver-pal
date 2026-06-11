# SAP Middleware

Standalone Node.js (Express) service that sits between SAP and the Lovable
app. It holds **no database credentials** — it talks to two public endpoints
in the Lovable app (gated by a shared secret) to load SAP configs and write
the sync log, then forwards calls to SAP.

```
SAP UI ──► middleware (this service) ──► Lovable app ──► database
                  │
                  └────────────────────► SAP (basic / oauth / none)
```

## Folder layout

```
middleware/
├── .env.example
├── .gitignore
├── Dockerfile
├── install-windows-service.ps1
├── package.json
├── README.md
└── server.js               ← single-file Express app
```

## Endpoints

| Method | Path           | Auth (`x-shared-secret`) | Purpose                                                  |
| ------ | -------------- | ------------------------ | -------------------------------------------------------- |
| GET    | `/__health`    | no                       | Liveness probe used by the "Test middleware" button.     |
| POST   | `/sap/invoke`  | yes                      | Run a configured SAP API. Body: `{ configId, inputs }`.  |
| POST   | `/sap/test`    | yes                      | HEAD-probe a configured SAP endpoint. Body: `{ configId }`. |

Response envelope:

```json
{ "ok": true, "status": 200, "latency_ms": 123, "data": { ... } }
```

## Local run

```bash
cp .env.example .env
# Fill MIDDLEWARE_SHARED_SECRET to match the same secret in the Lovable app.
# Fill APP_BASE_URL with a STABLE host:
#   https://project--<project-id>-dev.lovable.app   (latest preview build)
#   https://project--<project-id>.lovable.app       (published / production)
# DO NOT use https://id-preview--<project-id>.lovable.app — that host is
# auth-gated and the middleware cannot call it (it will fail with
# "APP_BASE_URL is auth-gated").


npm install
npm start            # listens on PORT (default 3005)
# or for auto-reload during development:
npm run dev
```

## Environment variables

| Variable                    | Default  | Purpose                                                                 |
| --------------------------- | -------- | ----------------------------------------------------------------------- |
| `PORT`                      | `3005`   | Port the middleware listens on. Match the UI "Middleware Port" field.   |
| `MIDDLEWARE_SHARED_SECRET`  | —        | Must equal the `MIDDLEWARE_SHARED_SECRET` secret in Lovable Cloud and the "Proxy Secret / Password" in the UI. Required. |
| `APP_BASE_URL`              | —        | Base URL of the Lovable app (preview or published). Required unless `MIDDLEWARE_MOCK=1`. |
| `MIDDLEWARE_MOCK`           | `0`      | Set to `1` to skip the app call and use only the `SAP_BP_*` envs below (offline smoke test). |
| `SAP_REQUEST_TIMEOUT_MS`    | `30000`  | Timeout for outbound SAP HTTP calls (probe + invoke) and app calls.     |
| `SAP_CONNECT_TIMEOUT_MS`    | `60000`  | HTTP keep-alive timeout for incoming clients.                           |
| `SAP_HEADERS_TIMEOUT_MS`    | `60000`  | Max time to receive incoming request headers.                           |
| `SAP_BODY_TIMEOUT_MS`       | `60000`  | Max time to receive incoming request body.                              |
| `SAP_BP_API_URL`            | —        | Fallback endpoint for `COMMON`/`SD` rows missing a URL (and for mock).  |
| `SAP_DMS_API_URL`           | —        | Fallback endpoint for `MM` rows missing a URL.                          |
| `SAP_BP_USERNAME`           | —        | Fallback username when a row has no credentials.                        |
| `SAP_BP_PASSWORD`           | —        | Fallback password when a row has no credentials.                        |

Per-row values from **SAP API Settings → APIs → Details / Credentials** always
win; the `SAP_BP_*` / `SAP_DMS_*` envs are only used when a row is missing
that field, or when `MIDDLEWARE_MOCK=1`.

## Why no Supabase keys here?

The middleware deliberately does NOT use the Supabase service-role key. That
key is not exposed to users on Lovable Cloud. Instead, the Lovable app
exposes two public endpoints — `POST /api/public/middleware/config` and
`POST /api/public/middleware/log` — protected by the same
`MIDDLEWARE_SHARED_SECRET`. The app uses its server-side admin client to
read the SAP tables, so SAP credentials stay behind RLS.

## Docker

```bash
docker build -t sap-middleware .
docker run -p 3005:3005 --env-file .env sap-middleware
```

## Windows Service (production on-prem)

From an **elevated PowerShell** in this folder:

```powershell
# Install + start
.\install-windows-service.ps1

# Stop + uninstall
.\install-windows-service.ps1 -Uninstall
```

The service is registered as `SAPMiddleware`, runs `node server.js` on boot,
and can be managed via `services.msc`, `net start SAPMiddleware`, etc.

## Wiring in the UI

1. Open **SAP API Settings → Middleware Configuration**.
2. Set:
   - Connection Mode = `Via Proxy`
   - Middleware Port = `3005`
   - Node.js Middleware URL = `http://<host-running-this-service>:3005`
   - Proxy Secret / Password = same value as `MIDDLEWARE_SHARED_SECRET` in `.env`
3. Save, then click **Test middleware**. It hits `GET /__health`.
4. Open any API row in the APIs tab and click **Test connection** — it now
   hits `POST /sap/test`, which loads the config from the Lovable app, then
   exercises the SAP endpoint with the configured auth + headers.

## Quick offline test

Without filling `APP_BASE_URL`, you can verify SAP connectivity from the
middleware host:

```bash
MIDDLEWARE_MOCK=1 \
SAP_BP_API_URL='http://10.200.1.2:8000/vendor/bp/create?sap-client=300' \
SAP_BP_USERNAME='YOUR_USER' \
SAP_BP_PASSWORD='YOUR_PASS' \
node server.js

curl -X POST http://localhost:3005/sap/test \
  -H 'x-shared-secret: 123456' -H 'content-type: application/json' \
  -d '{"configId":"00000000-0000-0000-0000-000000000000"}'
```
