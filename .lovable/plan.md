# Get /login rendering again on the Quality server

## What the evidence shows

- `curl http://127.0.0.1:8080/login` returns the branded "This page didn't load" page. That page is produced by `src/lib/error-page.ts`, so the app server is alive and the SSR render itself threw.
- The pm2 lines pasted are only the tail of a React stack (`renderNodeDestructive`, `finishFunctionComponent`). The actual `Error: …` message line sits above them and has not been seen yet, so the exact cause is **not yet confirmed**.
- The same page renders **HTTP 200** in this environment from the same source, so this is environment/config specific to that box, not a code bug in the login page.
- Separately, nginx on 8081 was previously proven to serve `index.html` from disk instead of proxying to 8080 — that must be fixed too, otherwise even a healthy 8080 will not be what the browser sees.

## Step 1 — capture the real message (one command)

```bash
pm2 logs Qty_App --lines 200 --nostream | grep -n -B4 "renderNodeDestructive" | head -40
```

The line containing `Error:` names the fault. Paste it and the fix becomes exact.

## Step 2 — make the login page load even when SSR fails (the immediate unblock)

Today any SSR throw gives a dead end. This changes the server so a render failure falls back to the client shell instead:

- Build emits a `server/ssr-fallback.html` shell containing the correct hashed asset tags from the build manifest (same tags SSR would emit), kept in the bundle rather than at `dist/` root so nginx can never serve it stale.
- `src/server.ts`: when the SSR response is a catastrophic 500, log the raw error, then respond with that shell (HTTP 200). The browser boots the app, TanStack Router renders `/login` client-side, and login works through the middleware exactly as before.
- Root `errorComponent` keeps its branded fallback for in-render client errors.

Net effect: even with the unknown SSR fault still present, the login page appears and users can sign in.

## Step 3 — make the failure legible in pm2

- `src/server.ts` and the request error middleware log `error.name: error.message` on its own first line, then the stack, and prefix it with `[ssr]` so `pm2 logs Qty_App | grep '\[ssr\]'` finds it instantly.
- `start.mjs` prints the Node version and the env keys it loaded on boot (values never printed), so a missing runtime value shows up before the first request.

## Step 4 — nginx: the one block that is wrong

Your config ends with:

```nginx
location / { try_files $uri $uri/ /index.html; }
```

That serves a static `index.html` from disk, which is why the browser 404s hashed
assets and never reaches the app server. In self-host mode there is no static
shell — the app server renders every page. Replace that block (and drop `root`'s
`index index.html;` role for `/`) with a proxy to `app_server`:

```nginx
    # ---- app routes -> SSR app server (no static shell in self-host mode)
    location / {
        proxy_pass http://app_server;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_connect_timeout 30s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_buffering off;
    }
```

Everything else in your file stays as it is: `/_serverFn/`, `/api/`, `/supabase/`,
`/studio/`, `/mw/`, `/assets/` and `/sw.js` are all correct. `root` stays so
`/assets/` and `/sw.js` keep being served from disk — and they must come from the
*same* freshly deployed `dist/`. Also add `manifest.webmanifest` next to `/sw.js`
with `no-store`.

The complete corrected file will be written to
`deploy/quality/nginx/resl-approval-quality-8081.conf` so you can copy it as one
piece, and pasted in chat.

Apply with:

```bash
nginx -t && nginx -s reload
```

Note: fixing nginx alone will not fix `curl http://127.0.0.1:8080/login` — that is
the SSR fault in Steps 1–3. Both are needed.


## Deploy sequence after the change

```bash
npm run build:selfhost && npm run package:dist
# copy quality-frontend-dist.tar.gz, then on the server:
cd /data/webapplication/resl_approval/Quality/frontend
mv dist "dist-broken-$(date +%Y%m%d-%H%M%S)"
mkdir dist && tar -xzf quality-frontend-dist.tar.gz -C dist
cd dist && bash deploy-frontend.sh
```

## Technical notes

Files touched: `src/server.ts`, `src/lib/error-page.ts` (adds shell renderer), `scripts/collect-dist.mjs` (emit `server/ssr-fallback.html` from the client manifest), `scripts/start-server.mjs` (boot diagnostics), `src/start.ts` (error middleware logging). No application, database, middleware or SAP logic changes.
