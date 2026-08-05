# Frontend-only `dist` (static build) for this app

You want `npm run build` to produce a purely static `dist/` (with `index.html` + `assets/`) that nginx can serve on its own — like your other Lovable project.

That is achievable, but it is not a config switch here. The reason your other project works out of the box is that it has **no server code**. This app has ~10,000 lines of server code across 26 server-function modules, and today the browser never talks to SAP or the mail server directly — it calls the app's own server, which then does the work.

## What must move before `dist` can be static

Server-only work currently living inside the app server:

- SAP calls (`sap-client.server.ts`) — signs requests with the shared secret and calls the middleware; the secret must never reach the browser
- SAP login / forgot password (`sap-login`, `sap-forgot`)
- Email sending (`nodemailer`) — SMTP credentials
- Web push (`web-push`) — VAPID private key
- Admin/user management + screen-permission checks using the privileged database key

If the app is served as static files, none of this can run. Each one has to be re-homed in the existing Node middleware service (`middleware/`, port 3002), which already has `/sap/invoke`, `/sap/test` and the shared-secret guard.

## Plan

### Phase 1 — Static build output
- Enable SPA/static output so the build emits `dist/index.html` + `dist/assets/` and no `server/` folder.
- Keep `scripts/collect-dist.mjs` only for copying `public/` extras (favicon, sitemap, manifest, sw.js) — drop the server-bundle and `.wrangler` handling.
- nginx: serve `dist/` directly with SPA fallback (`try_files $uri /index.html`) so `/mm/pr-release` etc. survive a refresh; keep the existing `/api/*` proxy to the middleware.

### Phase 2 — Move server logic to the middleware
Add authenticated endpoints in `middleware/server.js` grouped by area, and replace each `createServerFn` in the app with a typed `fetch` client:

```text
POST /app/sap/:api-key      -> all SAP fetch/save calls (SD, MM, plants, customers, search terms)
POST /app/auth/login        -> SAP login
POST /app/auth/forgot       -> forgot password + email
POST /app/notify/push       -> web push send
POST /app/admin/*           -> user management, roles, screen permissions, SAP API settings
```

- Every endpoint validates the caller's session token (database-verified) before doing work; screen-permission checks move server-side into the middleware, not the browser.
- SMTP creds, VAPID private key, SAP shared secret and the privileged database key live only in `middleware/.env`.
- The browser keeps using the database client directly for ordinary reads (row-level security already applies).

### Phase 3 — Cleanup and verification
- Delete the SSR entry (`src/server.ts`), server error wrapper, MCP server routes and `src/routes/api/*` if you no longer want the agent/webhook surface (confirm before removing).
- Remove `npm start` / wrangler scripts — deployment becomes "copy `dist/`, reload nginx" plus the middleware container.
- Verify: build produces `index.html`; login, one SD screen, one MM screen, email and push all work through the middleware; deep-link refresh works.

## Trade-offs to be aware of

- Login and every approval screen depends on the middleware being up; today they are one service, after this they are two.
- The MCP agent integration and the `/api/public/*` webhook route cannot exist on a static host — they would move to the middleware or be dropped.
- This is a large change touching 26 modules. It should be done in slices (auth first, then SD, then MM, then admin/email/push), each verified before the next.

## Alternative, if the goal is just "no `server/` folder in dist"

Phase 1 alone gives you `dist/index.html` + `assets/`, but every SAP screen breaks until Phase 2 lands. Confirm you want the full migration before I start.
