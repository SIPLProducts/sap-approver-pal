# 08 — Frontend Deployment

## 1. What "frontend" means here

This is a **TanStack Start SSR application**. `bun run build` produces one
artifact that serves both the browser assets and the application's own
server-side API. There is no static `dist/` that Nginx can serve alone, and no
separate API process to start.

The build targets the `workerd` runtime, and the built output is run locally by
`wrangler --local` (which bundles `workerd`). PM2 supervises that command. No
Cloudflare account and no network calls to Cloudflare are involved.

Release layout inside `Quality/frontend`:

```text
Quality/frontend
├── releases/
│   ├── 20260803-101500/     # a build
│   └── 20260803-142200/
├── current -> releases/20260803-142200      # symlink PM2 runs from
└── repo/                                    # bare-ish git checkout used to build
```

`current` is what makes rollback instant (guide 12).

---

## 2. Check out the source

```bash
sudo -iu deploy
cd /data/webapplication/resl_approval/Quality/frontend
mkdir -p releases
git clone <YOUR_REPO_URL> repo
cd repo
git checkout main         # or your release tag
```

## 3. Build-time environment

`VITE_*` variables are **compiled into the browser bundle**. They must be
present when `bun run build` runs, and changing one requires a **rebuild** — a
PM2 restart will not pick it up.

```bash
cd /data/webapplication/resl_approval/Quality/frontend/repo
cp /data/webapplication/resl_approval/Quality/frontend/.env.build .env
```

`.env.build` (template: `deploy/quality/.env.frontend.example`,
`chmod 600`):

```ini
VITE_SUPABASE_URL=https://api-quality.example.com
VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY from Quality/supabase/.env>
VITE_SUPABASE_PROJECT_ID=resl-quality
```

## 4. Install and build

```bash
bun install --frozen-lockfile
bun run build
```

Expected output:

```text
dist/
├── client/            # hashed browser assets (immutable)
└── server/
    ├── wrangler.json  # what wrangler runs
    └── ...            # SSR + server-function bundle
```

Build notes:

- `--frozen-lockfile` fails rather than silently resolving different versions.
- Peak memory is around 2–3 GB; the 4 GB swap from guide 01 covers spikes.
- The build is CPU-heavy. On a busy server, run it during a maintenance window
  or build on a separate machine and ship `dist/`.

## 5. Publish the release

```bash
cd /data/webapplication/resl_approval/Quality/frontend
REL="releases/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$REL"
rsync -a repo/dist/ "$REL/dist/"
ln -sfn "$REL" current-new && mv -Tf current-new current
ls -l current
```

`ln -sfn` + `mv -T` swaps the symlink atomically, so no request ever sees a
half-written directory.

## 6. Runtime environment

Server-only values are **not** in the bundle; they are passed to the worker at
start time. Put them in `Quality/frontend/.env.runtime` (`chmod 600`):

```ini
SUPABASE_URL=https://api-quality.example.com
SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>
SUPABASE_ANON_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>     # bypasses RLS — never prefix with VITE_
MIDDLEWARE_SHARED_SECRET=<same value as the middleware>
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:no-reply@example.com
NODE_ENV=production
PORT=3000
```

Generate the web-push keys once:

```bash
docker run --rm node:22-alpine sh -c "npm i -g web-push >/dev/null 2>&1 && web-push generate-vapid-keys"
```

The ecosystem file passes these through to `wrangler` with `--var`. See
`deploy/quality/ecosystem.config.cjs`.

## 7. Start under PM2

```bash
cd /data/webapplication/resl_approval/Quality/scripts
pm2 start ecosystem.config.cjs --only resl-quality-app
pm2 save
pm2 logs resl-quality-app --lines 50
```

## 8. Caching strategy

| Path | Policy | Set by |
|---|---|---|
| `/assets/*` (hashed filenames) | `public, max-age=31536000, immutable` | Nginx (guide 10) |
| `/sw.js`, `/manifest.webmanifest` | `no-cache` — must revalidate so PWA updates land | Nginx |
| HTML / SSR responses | `no-store` — rendered per request, per user | app + Nginx |
| `/api/*` | never cached | Nginx `proxy_no_cache` |

Because asset filenames are content-hashed, a one-year immutable cache is safe:
a new build produces new names.

## 9. Verification

```bash
curl -sI http://127.0.0.1:3000/login | head -1        # HTTP/1.1 200 OK
curl -s  http://127.0.0.1:3000/login | grep -o '<title>[^<]*'
pm2 status resl-quality-app                          # online, restarts 0
```

Verify the correct Supabase URL was baked in:

```bash
grep -rho 'api-quality\.example\.com' current/dist/client | head -1
```

Next: [09 — Nginx Installation](./09-nginx-install.md)
