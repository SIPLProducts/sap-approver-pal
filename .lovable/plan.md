
## Goal

Bring `middleware/server.js` in line with the env-variable style from your other project (the snippet you pasted), while keeping per-endpoint SAP details (URL, username, password, headers) sourced dynamically from the **SAP API Settings** screens in Lovable (screenshots 1 & 2). No frontend changes.

## What changes in `middleware/server.js`

1. **Env variable naming + defaults** — match your snippet:
   - `PORT` → default `3002` (keep, matches Middleware Port field).
   - `SHARED_SECRET` → renamed to **`MIDDLEWARE_SHARED_SECRET`** (still matches "Proxy Secret / Password" in Middleware Configuration tab). Default `123456` for dev.
   - Add timeout knobs, all read once at boot:
     - `SAP_REQUEST_TIMEOUT_MS` (default `30000`)
     - `SAP_CONNECT_TIMEOUT_MS` (default `60000`)
     - `SAP_HEADERS_TIMEOUT_MS` (default `60000`)
     - `SAP_BODY_TIMEOUT_MS` (default `60000`)
   - Add **optional** fallback envs, only used when a config row is missing fields:
     - `SAP_BP_API_URL`, `SAP_DMS_API_URL`, `SAP_BP_USERNAME`, `SAP_BP_PASSWORD`.
   - Keep `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (required — these load the dynamic configs).

2. **Per-call SAP details still come from the DB** (Screenshot 1 — Credentials tab, Details tab):
   - `endpoint_url`, `http_method`, `auth_type` from `sap_api_configs`.
   - `username`, `password_encrypted`, `extra_headers` from `sap_api_credentials`.
   - Request/response field mappings from `sap_api_request_fields` / `sap_api_response_fields`.
   - Env-level `SAP_BP_*` only kicks in as a last-resort fallback when the row has no URL/creds (useful for local smoke tests).

3. **Apply timeouts to outbound SAP `fetch` calls** using `AbortSignal.timeout(SAP_REQUEST_TIMEOUT_MS)` on both `/sap/test` (HEAD probe) and `/sap/invoke`. Surface a clean `{ ok:false, status:0, message:"timeout after Xms" }` instead of a hung request.

4. **Apply server-level timeouts** to the Express HTTP server:
   - `server.headersTimeout = HEADERS_TIMEOUT_MS`
   - `server.requestTimeout = BODY_TIMEOUT_MS`
   - `server.keepAliveTimeout = CONNECT_TIMEOUT_MS`

5. **Update `middleware/.env.example`** to list the new vars with comments explaining which UI field each one maps to.

6. **Update `middleware/README.md`** env table to match.

## What does NOT change

- Database schema, SAP API Settings UI, Middleware Configuration UI.
- Frontend `testSapConnection` server function and the `/sap/test` + `/sap/invoke` HTTP contract.
- Route structure (`/__health`, `/sap/test`, `/sap/invoke`).
- Single-file `server.js` layout, Dockerfile, Windows service installer.

## Files touched

- `middleware/server.js` — env renames, timeout consts, fetch timeouts, server timeouts, optional fallback when DB row lacks URL/creds.
- `middleware/.env.example` — new var names + comments.
- `middleware/README.md` — env table refreshed.

## Open question

Your snippet has `SAP_BP_API_URL` / `SAP_DMS_API_URL` as **hardcoded defaults**. In this app, every SAP endpoint is already configured per-row in **SAP API Settings → Details tab** (e.g. `Price_Approval_Fetch` in screenshot 1 has its own URL + username `SARVIINFO`). Confirm one of:

- **(A) Recommended:** keep env URLs as *fallback only* — DB row always wins. Matches the existing dynamic-config design.
- **(B)** Make env URLs *override* whatever is in the DB row (useful if you want to point all calls at a staging SAP from the middleware host without editing the UI).

Reply **A** or **B** and I'll build it.
