## Goal

Add a Node.js middleware service inside this repo that sits between the React/TanStack frontend and SAP. The middleware reads its runtime config (URL/port/secret) from the **Middleware Configuration** tab and per-endpoint config (URL, method, auth, request/response field maps) from the **API Configuration** records already stored in `sap_api_configs` / `sap_api_credentials` / `sap_api_request_fields` / `sap_api_response_fields`.

The frontend continues to call TanStack server functions; those server functions forward to the middleware whenever the global `connection_mode = via_proxy`. The middleware then calls SAP.

## Architecture

```text
React (browser)
   │  useServerFn
   ▼
TanStack server fn  (src/lib/sap/sap.functions.ts)
   │  if connection_mode = direct    → call SAP directly (existing sap-client.server.ts)
   │  if connection_mode = via_proxy → POST middleware_url/sap/invoke
   ▼
Node.js middleware  (/middleware, Express)
   │  validates x-shared-secret
   │  loads config by configId from Lovable Cloud (service-role)
   │  builds SAP request (auth, headers, body, query) from field maps
   ▼
SAP system  (OData / REST / SOAP-as-JSON)
```

The middleware is the only component that needs network reachability to on-prem SAP. It is deployed wherever the customer can reach SAP (Docker on a jump host, internal VM, etc.).

## What gets built

### 1. `/middleware` folder (new — a standalone Node service)

```text
middleware/
  package.json          # express, zod, node-fetch, @supabase/supabase-js, pino, dotenv
  tsconfig.json
  Dockerfile
  .env.example          # PORT, SHARED_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LOG_LEVEL
  README.md             # how to run locally + docker
  src/
    server.ts           # boot Express on PORT (from sap_global_settings.middleware_port)
    auth.ts             # requireSharedSecret middleware → checks x-shared-secret header
    config-loader.ts    # loadConfig(configId) → joins sap_api_configs + credentials + request/response fields, 30s in-memory cache
    sap-invoker.ts      # invokeSap(config, inputs) → builds URL/headers/body, fetches SAP, maps response via response field map
    field-mapping.ts    # applyRequestFields(fields, inputs), applyResponseFields(fields, rawJson)
    routes/
      health.ts         # GET /__health → { ok: true, version }
      invoke.ts         # POST /sap/invoke  body: { configId, inputs } → { ok, status, data, latency_ms }
      test.ts           # POST /sap/test    body: { configId }         → HEAD probe, used by "Test connection"
    lib/
      supabase.ts       # service-role client
      logger.ts         # pino
```

#### Endpoint contract

- `GET /__health` — no auth, returns `{ ok: true, uptime, version }`. Used by the existing "Test middleware" button.
- `POST /sap/invoke` — requires `x-shared-secret`. Body `{ configId: uuid, inputs: Record<string,unknown> }`. Resolves the config, applies request-field map (static/column/expr/secret), calls SAP with the configured auth (basic/oauth/none), applies response-field map, returns `{ ok, status, latency_ms, data, error? }`.
- `POST /sap/test` — requires `x-shared-secret`. Body `{ configId }`. HEAD-probes the endpoint with the configured auth and returns the same envelope. Writes one row to `sap_api_sync_log`.

All responses are JSON and include CORS headers so the middleware can also be hit from server-rendered tooling if needed (browser still goes through TanStack server fn, not directly).

### 2. Frontend / server-function wiring (minimal edits to existing code)

- `src/lib/sap/sap-client.server.ts` — add `invokeViaMiddleware(configId, inputs)` that reads `sap_global_settings` + `sap_global_secrets`, POSTs to `${middleware_url}/sap/invoke` with `x-shared-secret`, returns parsed JSON. Keep the existing direct-call path.
- `src/lib/sap/sap.functions.ts` — add `runSapApi({ configId, inputs })` server fn. Branches:
  - global `connection_mode = via_proxy` **or** the API row's `auth_type = 'proxy'` → `invokeViaMiddleware`
  - otherwise → existing direct call
- `src/lib/admin/sap-api.functions.ts` — `testSapConnection` already hits `/__health`. Extend it so when `auth_type = 'proxy'` it calls `POST /sap/test` with the configId instead, so the test actually exercises the SAP endpoint and not just middleware liveness.
- No DB schema changes. No new tables. No UI changes — the Middleware Configuration and APIs tabs already exist.

### 3. Local dev / run instructions (README in `/middleware`)

- `cp .env.example .env`, fill `SHARED_SECRET` to match the Proxy Secret saved in the UI, paste `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from Lovable Cloud project settings (admin only).
- `npm install && npm run dev` → listens on `PORT` (default 3002, matching the UI default).
- `docker build -t sap-middleware . && docker run -p 3002:3002 --env-file .env sap-middleware` for prod.
- In the SAP API Settings → Middleware Configuration tab: set Connection Mode = Via Proxy, Middleware URL = `http://<host>:3002`, Proxy Secret = same value as `SHARED_SECRET`, hit Save, then Test middleware.

## Out of scope

- Deploying the middleware for the user (it must run where SAP is reachable).
- SOAP/RFC/BAPI adapters — v1 is REST/OData JSON only; SOAP wrapper can be added later.
- Encrypting `sap_global_secrets.proxy_secret` and `sap_api_credentials.password_encrypted` at rest (still service-role-only).
- Multiple middleware profiles / per-environment routing.
- Auto-sync scheduler (the `auto_sync_enabled` + cron columns exist but are not wired here).

## Technical notes

- Middleware uses the **service role key** to read configs and credentials directly from Lovable Cloud, exactly like `client.server.ts` does. This keeps SAP credentials off the wire between TanStack and middleware — only `{ configId, inputs }` is sent.
- Config loader caches by `configId` for 30s to avoid hammering the DB on bursty calls; cache key includes `updated_at` so saves invalidate naturally on next read.
- Field mapping `source` values map to: `static` → `default_value`, `column` → `inputs[field_name]`, `expr` → small allow-listed evaluator (concat, ${input.x}, today()), `secret` → `process.env[default_value]`.
- Auth handling in middleware: `basic` → `Authorization: Basic base64(user:pass)`; `oauth` → client-credentials flow with token cached per config until expiry; `none` → no header; `proxy` is N/A here (we *are* the proxy).
- Logs every invocation to `sap_api_sync_log` with `config_id`, `status`, `latency_ms`, truncated `message`.
