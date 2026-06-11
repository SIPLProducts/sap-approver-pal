# SAP Middleware

Standalone Node.js (Express) service that sits between the React/TanStack
frontend and SAP. It reads its configuration from Lovable Cloud:

- **Middleware Configuration** (URL, port, shared secret) — set in the
  SAP API Settings → Middleware Configuration tab.
- **API Configuration** rows (endpoint URL, method, auth, request/response
  field maps) — set in the SAP API Settings → APIs tab.

The frontend never calls SAP directly. The flow is:

```
React → TanStack server fn → (this middleware) → SAP
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
# Fill MIDDLEWARE_SHARED_SECRET to match the Proxy Secret in the UI.
# Fill SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from Lovable Cloud project settings.

npm install
npm start            # listens on PORT (default 3002)
# or for auto-reload during development:
npm run dev
```

## Environment variables

| Variable                    | Default  | Purpose                                                                 |
| --------------------------- | -------- | ----------------------------------------------------------------------- |
| `PORT`                      | `3002`   | Port the middleware listens on. Match the UI "Middleware Port" field.   |
| `MIDDLEWARE_SHARED_SECRET`  | `123456` | Must equal "Proxy Secret / Password" in the UI. (`SHARED_SECRET` also accepted.) |
| `SUPABASE_URL`              | —        | Lovable Cloud URL. Required.                                            |
| `SUPABASE_SERVICE_ROLE_KEY` | —        | Lovable Cloud service-role key. Required.                               |
| `SAP_REQUEST_TIMEOUT_MS`    | `30000`  | Timeout for outbound SAP HTTP calls (probe + invoke).                   |
| `SAP_CONNECT_TIMEOUT_MS`    | `60000`  | HTTP keep-alive timeout for incoming clients.                           |
| `SAP_HEADERS_TIMEOUT_MS`    | `60000`  | Max time to receive incoming request headers.                           |
| `SAP_BODY_TIMEOUT_MS`       | `60000`  | Max time to receive incoming request body.                              |
| `SAP_BP_API_URL`            | —        | Optional fallback endpoint for `COMMON`/`SD` rows missing a URL.        |
| `SAP_DMS_API_URL`           | —        | Optional fallback endpoint for `MM` rows missing a URL.                 |
| `SAP_BP_USERNAME`           | —        | Optional fallback username when a row has no credentials.               |
| `SAP_BP_PASSWORD`           | —        | Optional fallback password when a row has no credentials.               |

Per-row values from **SAP API Settings → APIs → Details / Credentials** always
win; the `SAP_BP_*` / `SAP_DMS_*` envs are only used when a row is missing
that field.

## Docker

```bash
docker build -t sap-middleware .
docker run -p 3002:3002 --env-file .env sap-middleware
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
   - Middleware Port = `3002`
   - Node.js Middleware URL = `http://<host-running-this-service>:3002`
   - Proxy Secret / Password = same value as `MIDDLEWARE_SHARED_SECRET` in `.env`
3. Save, then click **Test middleware**. It hits `GET /__health`.
4. Open any API row in the APIs tab and click **Test connection** — it now
   hits `POST /sap/test` so it actually exercises the SAP endpoint with the
   configured auth + headers.

## Notes

- The middleware uses the Supabase **service role** key to load API configs
  and credentials directly from Lovable Cloud. SAP credentials never travel
  between TanStack and this service — only `{ configId, inputs }` does.
- Configs are cached in memory for 30 seconds and invalidate automatically
  when their `updated_at` changes.
- Supported auth modes: `basic`, `oauth` (client-credentials, token cached
  until expiry), `none`. `proxy` is not applicable here — this *is* the proxy.
