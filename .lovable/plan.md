# Deploy SAP Approver to a Linux Server with Docker (Quality + Prod)

## Architecture Overview

The application has three layers. Only two of them live in this repo and can be Dockerized on your Linux server; the third is managed by Lovable.

| Layer | What it is | Where it runs today | Dockerize on your server? |
|-------|------------|--------------------|---------------------------|
| **Frontend** | TanStack Start + React SPA (`vite build`) | Lovable Cloud preview/publish | Yes — self-host on your Linux server |
| **Middleware** | Node.js SAP proxy in `middleware/` | Your laptop / ngrok / Windows service | Yes — Dockerize on your server |
| **Backend** | Supabase (auth, database, storage, server functions) | Lovable Cloud | **Managed by Lovable** — do not move it unless you migrate to a self-hosted Supabase instance |

Recommended approach for your request: keep the Lovable Cloud backend, Dockerize the frontend and middleware, and run two isolated instances on the same Linux server: `quality` and `prod`.

---

## What Will Be Delivered

1. A production-grade `Dockerfile` for the frontend (multi-stage build with Node 22 + Nginx).
2. A ready-to-use `docker-compose.yml` that spins up four containers:
   - `frontend-quality`
   - `frontend-prod`
   - `middleware-quality`
   - `middleware-prod`
3. An Nginx reverse-proxy configuration (per-instance) with SSL via Let's Encrypt/Certbot.
4. Environment-variable files for both instances (`.env.quality`, `.env.prod`) without secret values.
5. A Git-based CI/CD script (optional) for automated deployments.
6. Updated `middleware/README.md` and new `DEPLOYMENT.md` docs.

---

## Step-by-Step Plan

### Phase 1 — Prepare the Frontend for Docker

- Add `nginx.conf` to the project root that serves static `dist/` files and falls back to `index.html` for TanStack Router client-side routes.
- Add `Dockerfile` at the project root:
  - Stage 1: Node 22 builder image, install dependencies with `npm ci` or `bun install`, run `vite build`.
  - Stage 2: Nginx Alpine image, copy `dist/` and the custom `nginx.conf`.
- Confirm the build command (`npm run build`) and the `dist/` output path from `vite.config.ts`.
- Ensure the frontend runtime only needs the Supabase public variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) which are already build-time safe.

### Phase 2 — Prepare the Middleware for Docker

- The `middleware/` folder already has a `Dockerfile` using `node:20-alpine`.
- Audit and harden it:
  - Pin the Node version to 20-alpine (or upgrade to 22-alpine).
  - Ensure `package*.json` and `server.js` are copied.
  - Expose the port declared in `PORT` (default 3005).
  - Add a health-check instruction.
- Add a `docker-compose.middleware.yml` entry or include the middleware service in the root compose file.

### Phase 3 — Quality and Production Instances

- Create two environment files at the project root:
  - `.env.quality`
  - `.env.prod`
- Each file contains instance-specific values:
  - Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `NODE_ENV`, `PORT`, `HOSTNAME`.
  - Middleware: `PORT`, `MIDDLEWARE_SHARED_SECRET`, `APP_BASE_URL`, `SAP_REQUEST_TIMEOUT_MS`, `SAP_BP_API_URL`, etc.
- Use Docker Compose profiles or two separate `docker-compose.<instance>.yml` files so both stacks can run concurrently on different ports.
- Map the middleware ports:
  - Quality middleware: `3005`
  - Prod middleware: `3006` (or another unused port)
- Map the frontend ports:
  - Quality frontend: `8080`
  - Prod frontend: `8081`

### Phase 4 — Reverse Proxy and SSL

- Install Nginx and Certbot on the Linux host.
- Create two server blocks:
  - `quality.sapapprover.yourdomain.com` → frontend-quality container
  - `prod.sapapprover.yourdomain.com` → frontend-prod container
- Proxy `/middleware` paths from the frontend domain to the corresponding middleware container if needed, or expose middleware on its own subdomain:
  - `quality-mw.sapapprover.yourdomain.com` → middleware-quality
  - `prod-mw.sapapprover.yourdomain.com` → middleware-prod
- Use Certbot to obtain and auto-renew Let's Encrypt certificates for all four domains.
- Redirect HTTP to HTTPS.

### Phase 5 — Secrets and Configuration

- Generate and store the `MIDDLEWARE_SHARED_SECRET` for both instances using Lovable Secrets (or your own secret manager).
- Store SAP credentials and app URLs in the middleware env files. Do not commit them to Git.
- Update the frontend SAP API Settings → Middleware Configuration screen to point to the correct middleware URL for each instance.
- Ensure both instances point to the same Supabase project or different Supabase projects depending on your data-isolation requirement.

### Phase 6 — CI/CD and Automation (Optional)

- Add a GitHub Actions / GitLab CI / shell script that:
  - Builds the frontend Docker image.
  - Builds the middleware Docker image.
  - Pushes both images to a private registry (Docker Hub, GHCR, AWS ECR, etc.).
  - SSH into the Linux server and pulls/restarts the relevant instance.
- Use tags or branch-based deployment:
  - `develop` branch → quality instance
  - `main` branch → prod instance

### Phase 7 — Health Checks and Monitoring

- Add a `/health` endpoint for the frontend (Nginx) and reuse the existing `/__health` endpoint for the middleware.
- Add `depends_on` and `healthcheck` blocks in Docker Compose.
- Configure log rotation for containers to prevent disk exhaustion.
- Set up a simple uptime monitor (optional) pointing to the health endpoints.

### Phase 8 — Documentation and Handover

- Create `DEPLOYMENT.md` at the project root with:
  - Prerequisites (Linux server, Docker, Docker Compose, Nginx, Certbot).
  - One-command setup instructions.
  - How to switch between quality and prod.
  - How to update secrets and redeploy.
- Update `middleware/README.md` to mention the Docker Compose path.

---

## Open Decisions (Confirm Before Building)

1. **Domain names:** What hostnames will you use for quality and prod (e.g., `qa.sapapprover.example.com` and `app.sapapprover.example.com`)?
2. **Backend isolation:** Should quality and prod share the same Lovable Cloud backend, or do you need a separate quality Supabase project?
3. **Middleware exposure:** Do you want the middleware exposed on its own subdomain, or only reachable from the frontend container via internal Docker network?
4. **CI/CD:** Do you use GitHub/GitLab for this repo, or do you prefer manual server-side builds?
5. **Linux server access:** Do you have root/SSH access to the server, or should I prepare the files for you to copy and run manually?

---

## Out of Scope Unless Explicitly Requested

- Migrating the Lovable Cloud backend to a self-hosted Supabase instance. This is a much larger migration and is usually unnecessary unless you need full data sovereignty.
- Setting up Kubernetes or complex orchestration; this plan targets Docker Compose on a single Linux server.
- Writing custom monitoring dashboards; only basic health checks and log rotation are included.

---

## Deliverables Summary

- `Dockerfile` (frontend)
- `nginx.conf`
- `middleware/Dockerfile` (updated/hardened)
- `docker-compose.quality.yml`
- `docker-compose.prod.yml` (or a single parameterized compose file)
- `.env.quality.example` and `.env.prod.example`
- Nginx server-block templates for all four domains
- Optional CI/CD workflow template
- `DEPLOYMENT.md`