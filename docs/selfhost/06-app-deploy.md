# 06 — Application deployment

## The one technical decision

This app is built by TanStack Start with the Cloudflare Workers preset
(`@cloudflare/vite-plugin`, `wrangler.jsonc`). `bun run build` produces:

```text
dist/client/          static assets
dist/server/index.mjs the SSR/server-function worker
dist/server/wrangler.json  worker config, with the client folder as its asset binding
```

Two ways to run that on your own server:

| | Option A — `workerd` locally (recommended) | Option B — Node preset |
|---|---|---|
| How | run the built worker with `wrangler dev` inside a container | change the build target to a Node server |
| Cloudflare account needed | **no** — `workerd` runs fully local | no |
| Code changes | none | edits `vite.config.ts` / build config |
| Risk | low; identical runtime to today | needs re-verification of server functions, SSR and the MCP routes |

**These documents and the shipped `Dockerfile.app` use Option A.** It keeps the
runtime byte-for-byte the same as the environment the app is already tested on,
so no behaviour changes. Option B is sketched at the end of this document for
completeness; treat it as a project of its own.

## 1. Fill in `.env.app`

```bash
cd /data/webapplication/resl_approval/Quality
cp .env.app.example .env.app
chmod 600 .env.app
nano .env.app
```

Quality values:

```bash
# ---- Client-visible (baked into the browser bundle at BUILD time) ----
VITE_SUPABASE_URL=https://api-quality.yourdomain.com
VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY from Quality/supabase/.env>
VITE_SUPABASE_PROJECT_ID=resl-quality

# ---- Server-only (read at RUNTIME) ----
SUPABASE_URL=https://api-quality.yourdomain.com
SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
SUPABASE_ANON_KEY=<ANON_KEY>

# Shared secret with the SAP middleware (step 07) — must match .env.middleware
MIDDLEWARE_SHARED_SECRET=<long random string, unique per environment>

# Web push (generate once per environment, see below)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:no-reply@yourdomain.com

NODE_ENV=production
PORT=3000
```

> `VITE_*` values are compiled into the browser bundle, so a change to them
> requires a **rebuild**, not just a restart. Server-only values are read at
> runtime and only need a restart. Never give a `VITE_` prefix to the service
> role key.

VAPID keys for push notifications:

```bash
docker run --rm node:22-alpine sh -c "npm i -g web-push >/dev/null 2>&1 && web-push generate-vapid-keys"
```

Production uses `PORT=3010`, the production hostnames, the production key set
and a different middleware secret.

## 2. Build the image

```bash
cd /data/webapplication/resl_approval/Quality
docker compose --env-file .env.app -p resl_quality_app build
```

The build reads `VITE_*` from `.env.app` as build args (see
`deploy/Dockerfile.app`) so the browser bundle points at the right Supabase URL.

## 3. Start

```bash
docker compose --env-file .env.app -p resl_quality_app up -d
docker compose -p resl_quality_app ps
docker compose -p resl_quality_app logs -f --tail=50 app
```

Health check:

```bash
curl -I http://127.0.0.1:3000/login
curl -kI https://quality.yourdomain.com/login
```

## 4. Or just use the deploy script

```bash
/data/webapplication/resl_approval/scripts/deploy.sh Quality
/data/webapplication/resl_approval/scripts/deploy.sh Production
```

It pulls the repo, rebuilds, restarts, and polls the health endpoint before
returning non-zero on failure.

## 5. Verify the app against your own backend

1. `https://quality.yourdomain.com/login` renders (no demo login panel — SAP
   auth only).
2. Sign in with a real SAP user. A failure here is usually the SAP API config
   rows or the middleware (step 07), not Supabase.
3. Admin → User Management lists users, plants and roles.
4. Open the browser devtools Network tab and confirm requests go to
   `api-quality.yourdomain.com`, not to any `*.supabase.co` host. If they do
   not, the `VITE_SUPABASE_URL` build arg was wrong — rebuild.

## 6. Service-worker / PWA note

`public/sw.js` and `manifest.webmanifest` are served from `dist/client`. After a
deployment, clients may hold a cached worker; a hard refresh
(`Ctrl+Shift+R`) picks up the new build.

## 7. Option B — building for a plain Node server

Only if you specifically do not want `workerd`:

1. Remove the Cloudflare build target so Nitro emits a Node server. That means
   overriding the preset that `@lovable.dev/vite-tanstack-config` applies and
   dropping `wrangler.jsonc` from the build path — an application-code change,
   which is why it is out of scope for these documents.
2. Rebuild and run `node dist/server/index.mjs` behind the same Nginx config.
3. Re-test in this order: SSR of every route, all `createServerFn` calls,
   `/api/public/middleware/*`, the MCP routes under `/.mcp`, web push, and
   e-mail sending. Several of these rely on runtime behaviour that differs
   between `workerd` and Node.

If you want this, say so and it can be implemented and verified as a separate
change.

Next: [07 — SAP middleware](./07-middleware.md)
