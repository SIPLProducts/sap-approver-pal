# 07 — SAP middleware

The middleware is the only component that must be able to reach SAP. It holds no
database credentials: it calls two endpoints in the app
(`/api/public/middleware/config` and `/api/public/middleware/log`), both gated by
`MIDDLEWARE_SHARED_SECRET`, and forwards approved calls to SAP.

```text
App (server functions) ──► middleware ──► SAP
        ▲                      │
        └──── config / log ────┘   (x-shared-secret)
```

## 1. Fill in `.env.middleware`

```bash
cd /data/webapplication/resl_approval/Quality
cp .env.middleware.example .env.middleware
chmod 600 .env.middleware
nano .env.middleware
```

Quality:

```bash
PORT=3005
MIDDLEWARE_SHARED_SECRET=<same value as in .env.app>
APP_BASE_URL=https://quality.yourdomain.com
MIDDLEWARE_MOCK=0

# Long SAP reports need headroom; keep Nginx at 300s or more (step 03)
SAP_REQUEST_TIMEOUT_MS=300000
SAP_CONNECT_TIMEOUT_MS=60000
SAP_HEADERS_TIMEOUT_MS=60000
SAP_BODY_TIMEOUT_MS=60000

# Optional fallbacks — per-row values in SAP API Settings always win
SAP_BP_API_URL=
SAP_DMS_API_URL=
SAP_BP_USERNAME=
SAP_BP_PASSWORD=
```

Production: `PORT=3005` inside the container (published on host `3006`),
`APP_BASE_URL=https://app.yourdomain.com`, and its own shared secret.

> `APP_BASE_URL` now points at **your** app hostname, not `*.lovable.app`. The
> old auth-gated `id-preview--*` restriction no longer applies.

## 2. Start

```bash
cd /data/webapplication/resl_approval/Quality
docker compose --env-file .env.middleware -p resl_quality_mw up -d --build
docker compose -p resl_quality_mw ps
curl http://127.0.0.1:3005/__health          # -> ok
curl -k https://mw-quality.yourdomain.com/__health
```

Production:

```bash
cd ../Production
docker compose --env-file .env.middleware -p resl_production_mw up -d --build
curl http://127.0.0.1:3006/__health
```

## 3. Wire it into the app

In the app, **Admin → SAP API Settings → Middleware Configuration**:

| Field | Quality | Production |
|---|---|---|
| Connection Mode | `Via Proxy` | `Via Proxy` |
| Middleware Port | `3005` | `3006` |
| Node.js Middleware URL | `https://mw-quality.yourdomain.com` | `https://mw.yourdomain.com` |
| Proxy Secret / Password | value of `MIDDLEWARE_SHARED_SECRET` (quality) | value of `MIDDLEWARE_SHARED_SECRET` (prod) |

Save, then **Test middleware** → expect `200 OK`.

Then in **SAP API Settings → APIs**, open a row and click **Test connection** —
that exercises `POST /sap/test`, which loads the config from the app and probes
the SAP endpoint with the stored auth and headers.

## 4. End-to-end smoke test

| Screen | What it proves |
|---|---|
| `/login` (SAP sign-in) | `Login_API` reachable; release keys (`PR_KEYS`, `PO_KEYS`, …) land in the profile |
| MM → PR Release | Release Group/Code dropdowns populated, `PR` fetch works |
| MM → PO Release | Plant dropdown shows top-bar plants, `PO_GET_API` works |
| MM → MIGO Release | Get Details / Check / Post round-trip |
| SD → Contract Approvals | Customer + Search Term F4 lazy loading |
| SD → BMW Status Report | Chunked long-running fetch stays under the 300s hops |

## 5. Endpoints reference

| Method | Path | Auth (`x-shared-secret`) | Purpose |
|---|---|---|---|
| GET | `/__health` | no | liveness; used by "Test middleware" |
| POST | `/sap/invoke` | yes | run a configured SAP API |
| POST | `/sap/test` | yes | probe a configured SAP endpoint |

Response envelope: `{ "ok": true, "status": 200, "latency_ms": 123, "data": {…} }`

## 6. Offline check (no app required)

Useful to prove the container can reach SAP at all:

```bash
docker run --rm -p 3999:3005 \
  -e MIDDLEWARE_MOCK=1 \
  -e MIDDLEWARE_SHARED_SECRET=test123 \
  -e SAP_BP_API_URL='http://10.200.1.2:8000/vendor/bp/create?sap-client=300' \
  -e SAP_BP_USERNAME='YOUR_USER' -e SAP_BP_PASSWORD='YOUR_PASS' \
  resl-middleware:latest &

curl -X POST http://localhost:3999/sap/test \
  -H 'x-shared-secret: test123' -H 'content-type: application/json' \
  -d '{"configId":"00000000-0000-0000-0000-000000000000"}'
```

## 7. Common failures

| Symptom | Cause |
|---|---|
| `Unauthorized` / `Invalid signature` | `MIDDLEWARE_SHARED_SECRET` differs between `.env.app`, `.env.middleware` and the UI field |
| `ECONNREFUSED` / timeout to SAP | container host cannot route to SAP; test with `docker exec … wget -S <sap-url>` |
| `504` from Nginx, `524` from a CDN | a gateway hop below `SAP_REQUEST_TIMEOUT_MS`; see step 03 |
| Middleware cannot load config | `APP_BASE_URL` wrong, or the app container is down |

Next: [08 — Operations](./08-operations.md)
