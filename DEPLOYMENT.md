# SAP Approver Pal — Linux Deployment Guide

This guide explains how to deploy the SAP middleware component on a Linux server (Ubuntu/Debian example). The middleware is the **only** piece that must live inside your network, because it reaches the on-premise SAP system on behalf of the Lovable frontend.

> **Important — frontend hosting**
> The Lovable frontend is built for Lovable Cloud / Cloudflare Workers. It uses server functions, authentication, and database access that are provided by Lovable Cloud. The recommended deployment is to **keep the frontend on Lovable Cloud** and **self-host only the SAP middleware** on your Linux server. This document covers that architecture.
> If you also need a fully air-gapped frontend, contact Lovable support or plan a separate migration to a self-hosted Supabase + TanStack Start setup.

----

## Architecture

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        Lovable Cloud (managed)                        │
│   React frontend + server functions + Supabase auth + database      │
│   Public URL: https://sap-approver-pal.lovable.app                  │
└──────────────────────┬──────────────────────────────────────────────┘
                       │ HTTPS
                       │ SAP API calls via proxy
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Your Linux server                               │
│   ┌──────────────────────┐         ┌──────────────────────┐       │
│   │ Nginx reverse proxy  │  ─────►  │ Docker               │       │
│   │ mw-prod.example.com  │          │ sap-middleware-prod  │       │
│   │  (SSL/443)           │          │  :3006 → :3005       │       │
│   └──────────────────────┘         └──────────────────────┘       │
│                                                                    │
│   ┌──────────────────────┐         ┌──────────────────────┐       │
│   │ Nginx reverse proxy  │  ─────►  │ Docker               │       │
│   │ mw-quality.example.com        │ sap-middleware-quality       │
│   │  (SSL/443)           │          │  :3005 → :3005       │       │
│   └──────────────────────┘         └──────────────────────┘       │
│                            │                                       │
│                            │ LAN / VPN / private route             │
│                            ▼                                       │
│                   ┌──────────────────┐                             │
│                   │ On-premise SAP   │                             │
│                   └──────────────────┘                             │
└─────────────────────────────────────────────────────────────────────┘
```

You will deploy **two isolated middleware instances**:

| Instance | Purpose | Host port | Nginx domain example |
|---|---|---|---|
| `sap-middleware-quality` | Connects to the Lovable **preview** URL | `3005` | `mw-quality.example.com` |
| `sap-middleware-prod` | Connects to the Lovable **published** URL | `3006` | `mw-prod.example.com` |

----

## Prerequisites

1. A Linux server (Ubuntu 22.04 LTS or newer recommended) with:
   - Docker 24.x+ and Docker Compose v2 (`docker compose` plugin)
   - Nginx
   - `certbot` for Let's Encrypt SSL
   - Outbound HTTPS to Lovable Cloud
   - Network reachability to your SAP system
2. DNS records pointing to the server:
   - `mw-quality.example.com` → server IP
   - `mw-prod.example.com` → server IP
3. The Lovable app must be published at least once so you know the stable URLs:
   - Preview: `https://project--06a5c0be-58b7-41a6-ac2d-e7706e765b64-dev.lovable.app`
   - Production: `https://sap-approver-pal.lovable.app`
4. A long random `MIDDLEWARE_SHARED_SECRET` for each instance. Keep it in a password manager.

----

## Step 1 — Clone the project on the server

```bash
# Example using your own repository
ssh user@your-server
git clone https://github.com/SIPLProducts/sap-approver-pal.git
cd sap-approver-pal
```

> Do not commit real `.env` files. The repo already ignores them.

----

## Step 2 — Create environment files

Copy the templates and edit each file with your real values.

```bash
cp .env.quality.example .env.quality
cp .env.prod.example .env.prod
```

### `.env.quality`

```bash
PORT=3005
MIDDLEWARE_SHARED_SECRET=CHANGE_ME_TO_A_LONG_RANDOM_STRING_QUALITY
APP_BASE_URL=https://project--06a5c0be-58b7-41a6-ac2d-e7706e765b64-dev.lovable.app
MIDDLEWARE_MOCK=0
SAP_REQUEST_TIMEOUT_MS=30000
SAP_CONNECT_TIMEOUT_MS=60000
SAP_HEADERS_TIMEOUT_MS=60000
SAP_BODY_TIMEOUT_MS=60000
# Optional SAP fallbacks (see README)
SAP_BP_API_URL=
SAP_DMS_API_URL=
SAP_BP_USERNAME=
SAP_BP_PASSWORD=
```

### `.env.prod`

```bash
PORT=3005
MIDDLEWARE_SHARED_SECRET=CHANGE_ME_TO_A_LONG_RANDOM_STRING_PROD
APP_BASE_URL=https://sap-approver-pal.lovable.app
MIDDLEWARE_MOCK=0
SAP_REQUEST_TIMEOUT_MS=30000
SAP_CONNECT_TIMEOUT_MS=60000
SAP_HEADERS_TIMEOUT_MS=60000
SAP_BODY_TIMEOUT_MS=60000
# Optional SAP fallbacks (see README)
SAP_BP_API_URL=
SAP_DMS_API_URL=
SAP_BP_USERNAME=
SAP_BP_PASSWORD=
```

> **Security rule:** Use a different shared secret for quality and prod. The secret must match the value stored in Lovable Cloud under **Project Settings → Secrets** for `MIDDLEWARE_SHARED_SECRET`.

----

## Step 3 — Build and start the Docker containers

```bash
docker compose up -d --build
```

Verify both containers are healthy:

```bash
docker compose ps
```

You should see both services with status `healthy` after the 10-second start period.

Smoke test each instance locally:

```bash
curl http://localhost:3005/__health
curl http://localhost:3006/__health
```

Both should return `ok`.

----

## Step 4 — Configure Nginx + SSL

### Install Certbot and request certificates

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

sudo certbot --nginx -d mw-quality.example.com -d mw-prod.example.com
```

### Copy the prepared server blocks

```bash
sudo cp nginx/middleware-quality.conf /etc/nginx/sites-available/middleware-quality
sudo cp nginx/middleware-prod.conf /etc/nginx/sites-available/middleware-prod

sudo ln -s /etc/nginx/sites-available/middleware-quality /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/middleware-prod /etc/nginx/sites-enabled/

sudo nginx -t
sudo systemctl reload nginx
```

> Replace `mw-quality.example.com` and `mw-prod.example.com` with your real domains. Update the `ssl_certificate` paths if Certbot placed them elsewhere.

### Test from outside the server

```bash
curl https://mw-quality.example.com/__health
curl https://mw-prod.example.com/__health
```

Both should return `ok`.

----

## Step 5 — Wire the middleware into the Lovable app

1. Open the **preview** app at:
   `https://project--06a5c0be-58b7-41a6-ac2d-e7706e765b64-dev.lovable.app`

2. Go to **Admin → SAP API Settings → Middleware Configuration** and set:
   - Connection Mode: `Via Proxy`
   - Middleware Port: `3005` (not used in proxy mode, but match the form)
   - Node.js Middleware URL: `https://mw-quality.example.com`
   - Proxy Secret / Password: the same value as `MIDDLEWARE_SHARED_SECRET` in `.env.quality`

3. Click **Save**, then **Test middleware**. Expect `200 OK`.

4. Open the **published** app at:
   `https://sap-approver-pal.lovable.app`

5. Repeat the same steps but use:
   - Node.js Middleware URL: `https://mw-prod.example.com`
   - Proxy Secret / Password: the same value as `MIDDLEWARE_SHARED_SECRET` in `.env.prod`

6. In **SAP API Settings → APIs**, test a few SAP connections to confirm the middleware reaches SAP.

----

## Step 6 — Managing the service

### View logs

```bash
# All services
docker compose logs -f

# One instance
docker compose logs -f sap-middleware-prod
```

### Restart

```bash
docker compose restart
```

### Update after code changes

```bash
git pull
docker compose up -d --build
```

### Stop everything

```bash
docker compose down
```

----

## Environment variables reference

| Variable | Purpose | Quality example | Prod example |
|---|---|---|---|
| `PORT` | Port inside the container | `3005` | `3005` |
| `MIDDLEWARE_SHARED_SECRET` | Shared secret between Lovable app and middleware | `...quality` | `...prod` |
| `APP_BASE_URL` | Stable Lovable URL the middleware talks to | Preview URL | Published URL |
| `MIDDLEWARE_MOCK` | Skip app call, use SAP_BP_* envs only | `0` | `0` |
| `SAP_REQUEST_TIMEOUT_MS` | Outbound SAP call timeout | `30000` | `30000` |
| `SAP_CONNECT_TIMEOUT_MS` | Keep-alive timeout for inbound clients | `60000` | `60000` |
| `SAP_HEADERS_TIMEOUT_MS` | Max time to receive request headers | `60000` | `60000` |
| `SAP_BODY_TIMEOUT_MS` | Max time to receive request body | `60000` | `60000` |
| `SAP_BP_API_URL` | Fallback URL for COMMON/SD rows | `http://...` | `http://...` |
| `SAP_DMS_API_URL` | Fallback URL for MM rows | `http://...` | `http://...` |
| `SAP_BP_USERNAME` | Fallback username | `YOUR_USER` | `YOUR_USER` |
| `SAP_BP_PASSWORD` | Fallback password | `YOUR_PASS` | `YOUR_PASS` |

See `middleware/README.md` for more details on the mock mode and fallback credentials.

----

## Security checklist

- [ ] `.env.quality`, `.env.prod`, and any `.env` files are **not** committed to Git.
- [ ] `MIDDLEWARE_SHARED_SECRET` is at least 32 characters and different for each instance.
- [ ] Middleware containers run as a non-root user (`sapmid`).
- [ ] Nginx enforces HTTPS and redirects HTTP to HTTPS.
- [ ] The Linux firewall allows only 22/80/443 inbound and blocks direct access to ports 3005/3006 from the public internet.
- [ ] SAP credentials are entered only in the Lovable app **SAP API Settings** (not in env files) unless you are using mock/fallback mode.
- [ ] Docker logs are rotated to avoid disk fill.

----

## Troubleshooting

### Middleware says "APP_BASE_URL is auth-gated"

You are using the `id-preview--*.lovable.app` URL. Switch to the stable preview URL ending in `-dev.lovable.app` or the published URL.

### "Unauthorized" or "Invalid signature" in the app

The `MIDDLEWARE_SHARED_SECRET` in the Lovable Cloud secret does not match the value in the middleware env file. Fix one side, save, and restart the container.

### SAP requests time out

The middleware host cannot reach the SAP network, or the SAP timeout is too low. Increase `SAP_REQUEST_TIMEOUT_MS` or verify routing from the server to SAP.

### The app shows `SAP returned 524` (or 504) on long reports

`524` is **not** a SAP error — it is a gateway timeout raised in front of the middleware. Long reports such as the **BMW Status Report** can run for several minutes; every hop between the app and the middleware must allow at least that long:

| Hop | Setting | Required |
|---|---|---|
| Cloudflare (if the middleware hostname is proxied) | hard ~100 s cap, not configurable on Free/Pro | Set the middleware DNS record to **DNS only (grey cloud)**, or use a Cloudflare Tunnel / Enterprise timeout |
| nginx | `proxy_read_timeout`, `proxy_send_timeout`, `send_timeout` | `300s` (already set in `nginx/middleware-*.conf`) |
| middleware | `SAP_REQUEST_TIMEOUT_MS` | `300000` for large reports |

An orange-clouded (proxied) hostname can never exceed ~100 s regardless of the nginx values, so that DNS change is mandatory when SAP needs longer. After editing the nginx config run `sudo nginx -t && sudo systemctl reload nginx`.

In the app itself the BMW Status Report also splits large date ranges into monthly windows so each SAP call stays short — narrowing "Contract/sales created from/to" is the quickest workaround if a single window is still too slow.


### Containers fail to start

Check the env files exist and contain no trailing spaces:

```bash
docker compose logs sap-middleware-quality
docker compose logs sap-middleware-prod
```

----

## Optional: CI/CD

For automated deployment, add a GitHub Actions / GitLab CI step that:

1. SSHs into the Linux server (store the key as a secret).
2. Runs `git pull`.
3. Runs `docker compose up -d --build`.
4. Posts the result to a Slack/Teams channel.

Keep the env files on the server; do not recreate them in CI unless you are using a secret manager.

----

## Next steps

- Publish the Lovable app to production if you have not already.
- Configure both middleware instances and test SAP connectivity from quality and prod.
- Set up monitoring for the container health (`docker compose ps`) and Nginx uptime.
