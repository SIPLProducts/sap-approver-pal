## Goal

Restructure `middleware/` to match the reference screenshot: a **flat folder with a single `server.js`** (plain Node, no TypeScript/`src/`), plus `.env.example`, `Dockerfile`, `install-windows-service.ps1`, `package.json`, `README.md`. Keep the existing SAP API integration (invoke / test / health, dynamic configs from Lovable Cloud, basic/oauth auth, field mapping).

## Target layout

```
middleware/
├── .env.example
├── .gitignore
├── Dockerfile
├── install-windows-service.ps1   ← NEW (node-windows installer)
├── package.json                  ← plain JS, no tsx/tsc
├── README.md
└── server.js                     ← single file: express + all routes + SAP invoker
```

The current `src/` tree (`server.ts`, `routes/*.ts`, `auth.ts`, `config-loader.ts`, `field-mapping.ts`, `sap-invoker.ts`, `lib/supabase.ts`, `lib/logger.ts`) and `tsconfig.json` will be deleted and consolidated into one `server.js`.

## What `server.js` will contain

All existing behavior, ported to ESM JavaScript in one file:

1. **Express bootstrap** — CORS, JSON body parser, port from `PORT` env (default 3002).
2. **Shared-secret auth middleware** — checks `x-shared-secret` header against `SHARED_SECRET`.
3. **Supabase client** — service-role, reads `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
4. **Config loader** — fetches `sap_api_configs` + `sap_api_credentials` + request/response field rows by `configId`, 30s in-memory cache keyed on `updated_at`.
5. **Field mapping** — `static / column / expr / secret` request resolution, `${input.x}`, `today()`, `now()` templating, response path mapping.
6. **SAP invoker** — builds auth headers (Basic / OAuth client-credentials with token cache), fires `fetch` against the configured endpoint, returns `{ ok, status, latency_ms, data }`.
7. **Routes**:
   - `GET /__health` — public liveness probe.
   - `POST /sap/test` — shared-secret; HEAD-probes the configured SAP endpoint; logs to `sap_api_sync_log`.
   - `POST /sap/invoke` — shared-secret; runs the SAP call with `{ configId, inputs }`; logs to `sap_api_sync_log`.
8. **Error handler** — JSON `{ ok: false, error }`.

## `package.json` (rewritten)

- `"type": "module"`, `"main": "server.js"`.
- Scripts: `start: node server.js`, `dev: node --watch server.js`.
- Deps: `@supabase/supabase-js`, `cors`, `dotenv`, `express`, `zod`. (Drops `pino`/`pino-pretty` — use `console.*` to keep it single-file and dependency-light, matching the reference style.)
- DevDeps removed entirely. Optional: `node-windows` listed under deps so `install-windows-service.ps1` works.

## `install-windows-service.ps1` (new)

PowerShell script that:
- Verifies Node.js is installed.
- Runs `npm install` in the middleware folder.
- Uses `node-windows` to register a Windows service named `SAPMiddleware` that runs `node server.js` from the current directory, auto-start on boot, logs to `.\daemon\`.
- Prints next steps (start/stop/uninstall commands).

## `Dockerfile` (updated)

Switch from `tsx` build to plain `node server.js`:
```
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server.js ./
COPY .env.example ./
EXPOSE 3002
CMD ["node", "server.js"]
```

## `.env.example` and `README.md`

- `.env.example` unchanged (PORT, SHARED_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LOG_LEVEL).
- `README.md` updated: drop TS/`src/` references, document `npm start`, Docker, and the Windows-service install step.

## Files deleted

- `middleware/src/**` (entire folder)
- `middleware/tsconfig.json`

## Files added

- `middleware/server.js`
- `middleware/install-windows-service.ps1`

## Files modified

- `middleware/package.json`
- `middleware/Dockerfile`
- `middleware/README.md`

## Not changed

- Frontend (`src/routes/_authenticated/admin.sap-api.*`, server fns under `src/lib/admin/sap-*`, `src/lib/sap/*`) — same HTTP contract (`/__health`, `/sap/test`, `/sap/invoke`, `x-shared-secret`).
- Database schema and existing SAP API configuration screens.
- Root `MIDDLEWARE.md` quickstart.

## Open question

The reference shows `server.js` only — no separate config/SAP modules. Confirm you're OK with **one ~300-line JS file** consolidating all middleware logic (matches your screenshot). If you'd prefer to keep it split (e.g. `server.js` + `sap.js` + `supabase.js`), say so and I'll adjust before implementing.