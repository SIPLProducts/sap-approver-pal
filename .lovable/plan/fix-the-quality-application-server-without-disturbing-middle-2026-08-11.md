# Fix the Quality application server without disturbing middleware

## Confirmed from the server output

- `Qty_Approval` is correctly running `/data/webapplication/resl_approval/Quality/middleware/server.js`.
- The middleware is healthy and listening on port `3002`.
- Its `APP_BASE_URL=http://10.150.150.130:8081` is valid for this architecture because Nginx sends `/api/*` back to the application server.
- `Qty_App` points to the correct intended file: `/data/webapplication/resl_approval/Quality/frontend/dist/start.mjs`.
- However, nothing listens on `8080` because the deployed `start.mjs` is syntactically invalid. PM2's `online` label only means its wrapper process exists; the port check is the authoritative result.
- The backend gateway (`8000`), Studio (`3000`), Nginx (`8081`), and middleware (`3002`) are already listening.

Therefore, this repair requires **no middleware code change, no middleware restart, and no Docker/backend restart**.

## Request path after the repair

```text
Browser :8081
  → Nginx
  → Qty_App :8080 for /_serverFn/* and /api/*
  → Qty_Approval :3002 for /login/Login_API
  → SAP

Browser → Nginx /supabase/* → backend gateway :8000
```

The frontend cannot safely call the middleware directly in this app. `Qty_App` runs the server login function, reads protected configuration, calls the middleware, and creates the authenticated application session after SAP accepts the credentials.

## Code change

Change one line in `scripts/collect-dist.mjs`. Inside the launcher template, preserve the regex backslashes in the generated file:

```js
// current source — emits a broken multiline regex
.split(/\r?\n/)

// corrected source — emits .split(/\r?\n/) into dist/start.mjs
.split(/\\r?\\n/)
```

No application, middleware, Nginx, or backend logic changes.

## Build and verify in VS Code

Before building, use the Quality browser-facing backend URL:

```ini
VITE_SUPABASE_URL=http://10.150.150.130:8081/supabase
VITE_SUPABASE_PUBLISHABLE_KEY=<Quality ANON_KEY>
```

Then run:

```bash
npm run build
node --check dist/start.mjs
grep -n "split" dist/start.mjs
```

Required result:

- `node --check dist/start.mjs` returns with no error.
- The generated file contains one complete line with `.split(/\r?\n/)`.
- The new `dist/` contains `index.html`, `assets/`, `server/`, `start.mjs`, and `package.json`.

Do not deploy the folder if this local syntax check fails.

## Replace `dist` on the Quality server

Only stop `Qty_App`; leave `Qty_Approval` running:

```bash
pm2 stop Qty_App

cd /data/webapplication/resl_approval/Quality/frontend
mv dist "dist_backup_$(date +%Y%m%d_%H%M%S)"
```

Copy the newly built folder from VS Code to:

```text
/data/webapplication/resl_approval/Quality/frontend/dist
```

Then:

```bash
cd /data/webapplication/resl_approval/Quality/frontend/dist
npm install --omit=dev
node --check start.mjs
```

The server-side syntax check must also pass before restarting PM2.

## Runtime environment for `Qty_App`

Create or restore `/data/webapplication/resl_approval/Quality/frontend/dist/.env.runtime` after replacing the folder:

```ini
PORT=8080
HOST=127.0.0.1
NODE_ENV=production
SUPABASE_URL=http://127.0.0.1:8000
SUPABASE_PUBLISHABLE_KEY=<Quality ANON_KEY>
SUPABASE_ANON_KEY=<Quality ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<Quality SERVICE_ROLE_KEY>
MIDDLEWARE_SHARED_SECRET=<exact same secret used by Qty_Approval>
```

```bash
chmod 600 /data/webapplication/resl_approval/Quality/frontend/dist/.env.runtime
```

Do not put the service-role key in the frontend `.env` or any `VITE_*` variable.

## Restart only `Qty_App`

The existing PM2 definition already has the correct script and working directory, so restart it after the verified deployment:

```bash
pm2 restart Qty_App --update-env
pm2 save
pm2 logs Qty_App --lines 80 --nostream
```

If the old PM2 definition does not survive the folder replacement, recreate only this process:

```bash
pm2 delete Qty_App 2>/dev/null || true
pm2 start /data/webapplication/resl_approval/Quality/frontend/dist/start.mjs \
  --name Qty_App \
  --cwd /data/webapplication/resl_approval/Quality/frontend/dist \
  --interpreter node \
  --time
pm2 save
```

Do not restart or recreate `Qty_Approval`.

## Verify each connection in order

```bash
# Existing middleware remains healthy
curl -fsS http://127.0.0.1:3002/__health

# Application server must now own port 8080
ss -ltnp | grep ':8080'
curl -i http://127.0.0.1:8080/

# Nginx must reach the application server
curl -i http://127.0.0.1:8081/
curl -i -X POST http://127.0.0.1:8081/api/public/middleware/config \
  -H 'content-type: application/json' \
  -d '{"name":"Login_API"}'

# Nginx routes to middleware and backend
curl -fsS http://127.0.0.1:8081/mw/__health
curl -fsS http://127.0.0.1:8081/supabase/auth/v1/health
```

For the unauthenticated `/api/public/middleware/config` test, `401 Invalid or missing x-shared-secret` is expected and proves the route reached `Qty_App`. A 502 or connection refusal means port `8080` is still unavailable.

## Nginx requirement

No Nginx change is needed if its active Quality server block already contains:

```nginx
root /data/webapplication/resl_approval/Quality/frontend/dist;

location /_serverFn/ {
    proxy_pass http://127.0.0.1:8080;
}

location /api/ {
    proxy_pass http://127.0.0.1:8080;
}

location /mw/ {
    proxy_pass http://127.0.0.1:3002/;
}

location /supabase/ {
    proxy_pass http://127.0.0.1:8000/;
}

location / {
    try_files $uri $uri/ /index.html;
}
```

Confirm the active configuration rather than editing it blindly:

```bash
sudo nginx -T | grep -nE 'listen 8081|root |location /(_serverFn|api|mw|supabase)'
```

Only if a block is missing or points to another port should Nginx be edited, followed by:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Final login verification

Keep these open in separate terminals and perform one login:

```bash
pm2 logs Qty_App --lines 100
pm2 logs Qty_Approval --lines 100
```

The expected order is: request appears in `Qty_App`, then `/login/Login_API` appears in `Qty_Approval`, then the SAP response returns and `Qty_App` creates the backend session.