# Quiet the app server's offline warnings on the Quality box

## What the log actually shows

`Qty_App` is now starting correctly. The important lines are:

```text
[wrangler:info] Parsed 1 valid header rule.
Local server updated and ready
```

The `TimeoutError: The operation was aborted due to timeout` at `setupCf` is **not** your application failing. On startup the runtime tries to download a Cloudflare metadata file (`Request.cf` placeholder data) from the internet. The Quality server has no outbound internet access, so that request times out after ~30 s, the runtime falls back to a placeholder, and it reconfigures itself — which is why you also see the repeating `Reloading local server...`.

Effects: slow startup, noisy logs, and a restart loop that can make port `8080` intermittently refuse connections. Login itself is unaffected once the server settles.

## Step 1 — Confirm the server is actually serving

```bash
ss -ltnp | grep ':8080'
curl -i http://127.0.0.1:8080/
curl -i -X POST http://127.0.0.1:8081/api/public/middleware/config \
  -H 'content-type: application/json' -d '{"name":"Login_API"}'
```

Expected: `8080` listening, `/` returns HTML, and the config route returns `401 Invalid or missing x-shared-secret` (proof the request reached the app server).

If those pass, login should already work through Nginx on `:8081`.

## Step 2 — Stop the metadata fetch (code change)

Update the launcher generated into `dist/start.mjs` by `scripts/collect-dist.mjs`:

- Set `CI=true` in the child process environment unless it is already set. The runtime skips the Cloudflare metadata download in CI mode, which removes both the `setupCf` timeout and the reload churn.
- Set `WRANGLER_SEND_METRICS=false` so no telemetry call is attempted on the closed network.
- Pass `--no-live-reload` is not needed; disabling the metadata fetch stops the reload loop.
- Print a single line at startup confirming offline mode, so future logs are easy to read.

Only `scripts/collect-dist.mjs` changes. No application, middleware, Nginx, or SAP configuration change.

## Step 3 — Optional immediate workaround (no rebuild)

If you do not want to rebuild right now, restart the existing process with those variables injected:

```bash
cd /data/webapplication/resl_approval/Quality/frontend/dist
pm2 delete Qty_App
CI=true WRANGLER_SEND_METRICS=false PORT=8080 HOST=127.0.0.1 \
  pm2 start start.mjs --name Qty_App --cwd "$PWD" --interpreter node --time --update-env
pm2 save
pm2 logs Qty_App --lines 40 --nostream
```

The `setupCf` timeout and the repeating reload lines should disappear.

## Step 4 — Redeploy with the fix

```bash
npm run build          # on the dev machine
node --check dist/start.mjs
```

Copy `dist/` to the server, keep `.env.runtime`, then:

```bash
cd /data/webapplication/resl_approval/Quality/frontend/dist
npm install --omit=dev
pm2 restart Qty_App --update-env
```

## Then verify login end to end

```bash
pm2 logs Qty_App --lines 100
pm2 logs Qty_Approval --lines 100
```

Sign in once. Expected order: the request appears in `Qty_App`, then `/login/Login_API` appears in `Qty_Approval`, then SAP responds and `Qty_App` creates the backend session.
