# SAP Approver Middleware

The `middleware/` folder in this repo is a standalone Node.js service that acts as a secure bridge between this Lovable frontend and your on-premise / private-network SAP system. It is deployed separately from the frontend (self-hosted, or temporarily exposed via ngrok during development).

## Why a middleware?

The Lovable frontend runs on the public internet and cannot reach a private SAP host directly. The middleware:

- Runs on a machine that **can** reach SAP (your laptop, a VM in your network, a Docker host, etc.).
- Authenticates incoming requests from the frontend using a shared secret.
- Forwards approved calls to SAP using the credentials stored in your backend.

## Quickstart (ngrok dev loop)

```bash
cd middleware
cp .env.example .env
# Fill in:
#   SHARED_SECRET=<long random string>
#   SUPABASE_URL=<your backend URL>
#   SUPABASE_SERVICE_ROLE_KEY=<service role key>
npm install
npm run dev          # listens on :3002
```

In a second terminal, expose it:

```bash
ngrok http 3002
# copy the https://<id>.ngrok-free.app URL
```

## Wire it into the app

Open the app → **Admin → SAP API Settings → Middleware Configuration**:

| Field                   | Value                                       |
| ----------------------- | ------------------------------------------- |
| Connection Mode         | `Via Proxy`                                 |
| Middleware Port         | `3002`                                      |
| Node.js Middleware URL  | `https://<id>.ngrok-free.app` (from ngrok)  |
| Proxy Secret            | Same value as `SHARED_SECRET` in `.env`     |

Click **Save**, then **Test middleware** — expect a `200 OK`.

## Self-hosting (production)

Use the included `middleware/Dockerfile`:

```bash
cd middleware
docker build -t sap-approver-middleware .
docker run -d --env-file .env -p 3002:3002 sap-approver-middleware
```

Put it behind your own HTTPS reverse proxy (nginx, Caddy, Traefik) on a hostname your frontend can reach, then plug that URL into the same **Middleware Configuration** screen above.

See [`middleware/README.md`](./middleware/README.md) for full configuration reference, routes, and troubleshooting.
