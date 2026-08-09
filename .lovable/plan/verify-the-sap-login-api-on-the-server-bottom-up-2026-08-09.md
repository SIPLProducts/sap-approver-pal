# Verify the SAP Login API on the server, bottom-up

Goal: on the Quality server, prove that the SAP login response reaches you at each hop before touching the app UI. Order matters — stop at the first failing hop.

## How login is wired (already built)

```text
Browser (login page)
  -> App server :8080   sapLogin server function
       reads sap_global_settings.middleware_url
  -> Middleware :3005   POST /login/Login_API
       loads the "Login_API" row via APP_BASE_URL/api/public/middleware/config
  -> SAP        http://10.150.150.154:8103/sd_approval_mng/login/login?sap-client=300
```

- Middleware auth: header `x-shared-secret` must equal `MIDDLEWARE_SHARED_SECRET` in `middleware/.env`, the same secret on the app side, and the Proxy Secret stored in SAP API Settings.
- SAP Basic auth user/password come from the global SAP Connection rows (`sap_global_settings.sap_username` + `sap_global_secrets.sap_password`), not per-API rows — so `SARVIINFO / Sh@rv!0526` belongs there.
- The app calls the middleware only when `sap_global_settings.middleware_url` is set; otherwise it calls SAP directly from :8080.

## Hop 1 — SAP reachable from the server itself

```bash
curl -sS -i -u 'SARVIINFO:Sh@rv!0526' \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  'http://10.150.150.154:8103/sd_approval_mng/login/login?sap-client=300' \
  -d '{"LOGIN":{"USER":"SURYA001","PASSWORD":"Welcome"}}'
```
Expect the USER/PLANTS JSON. HTML login page = wrong/missing Basic auth. Timeout = network/firewall from this server to 10.150.150.154:8103.

## Hop 2 — middleware alive

```bash
curl -sS http://127.0.0.1:3005/__health
```
If dead, start it from the middleware folder (`npm ci && node server.js`, or its PM2/service entry) and confirm `.env` has `PORT`, `MIDDLEWARE_SHARED_SECRET`, `APP_BASE_URL`.

## Hop 3 — middleware -> app config lookup

```bash
curl -sS -X POST "$APP_BASE_URL/api/public/middleware/config" \
  -H 'Content-Type: application/json' -H "x-shared-secret: <SECRET>" \
  -d '{"name":"Login_API"}'
```
`ok:true` with a non-null `endpoint_url` and filled `credentials.username/password` is required. 401 = secret mismatch, 404 = no `Login_API` row, 409 = row inactive, null credentials = global SAP Connection not saved.

## Hop 4 — login through the middleware

```bash
curl -sS -i -X POST http://127.0.0.1:3005/login/Login_API \
  -H 'Content-Type: application/json' -H "x-shared-secret: <SECRET>" \
  -d '{"inputs":{"LOGIN":{"USER":"SURYA001","PASSWORD":"Welcome"}}}'
```
This is the exact call the app makes. Same JSON as hop 1 means the middleware path is good.

## Hop 5 — app server function

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/
```
502 at `/login` means this is down — start the compiled app runtime (`dist/server`) on 8080 with its backend env loaded, then retry the browser login and read `sap_api_sync_log` (message starts with `login middleware:`) for the recorded outcome.

## Settings that must be correct in SAP API Settings

- `Login_API` row: active, POST, endpoint `/sd_approval_mng/login/login?sap-client=300` (or full URL), auth type basic.
- Global SAP Connection: base URL `http://10.150.150.154:8103`, username `SARVIINFO`, password `Sh@rv!0526`.
- Middleware Configuration: middleware URL `http://127.0.0.1:3005` (as seen from the app server) and the matching proxy secret.

## What I will do on approval

Nothing in this plan changes code — it is a verification runbook. Tell me which hop fails, with its output, and I will plan the fix for that hop (config seed, credential rows, middleware env, or app-server startup).
