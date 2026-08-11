# The real cause found — and the answer on whether 8080 is required

Your foreground run is the proof I needed. Look at the last two lines:

```text
[start] serving app server on http://127.0.0.1:8080
root@ReAprMatrix:.../dist#
```

It printed the banner and **returned to the prompt**. A real server never returns.
So the process exits instantly, which is exactly why nothing listens on 8080 and why
nginx answers 502. The launcher is fine; the bundle it loads is the wrong kind.

`dist/server/index.mjs` in this folder is a **Cloudflare worker bundle** — it exports
a fetch handler and opens no port. That is what `npm run build` produces. Only
`npm run build:selfhost` produces a plain Node HTTP server that binds a port. So this
`dist/` was built with the wrong command.

## Fix (one build, one copy — nothing else changes)

On your build machine:

```bash
npm ci
npm run build:selfhost
```

Copy the whole folder again, then:

```bash
rsync -a --delete dist/ root@10.150.150.130:/data/webapplication/resl_approval/Quality/frontend/dist/
```

On the server:

```bash
cd /data/webapplication/resl_approval/Quality/frontend/dist
PORT=8080 HOST=127.0.0.1 node start.mjs      # must now STAY running
```

Once it stays running, Ctrl-C and hand it to pm2:

```bash
bash deploy-frontend.sh
pm2 save && pm2 startup
```

`--delete` matters: it removes the old worker `server/` so you cannot end up running
the stale bundle.

## "Can we skip 8080 and go browser -> middleware -> SAP?"

Not safely, and not without rewriting the login. Reasons, plainly:

- The service-role key and the middleware shared secret live on 8080. Moving those
  calls into the browser publishes both — anyone opening the site could read them and
  call SAP directly.
- Login does more than call SAP: it creates the backend session and caches your SAP
  profile (plants, roles, activities, PR/PO/NFA release keys) that drives screen
  permissions. That work needs a trusted server.
- Every screen already calls `/_serverFn/*` — PR/PO/ZNFA release, MIGO, user
  management, e-mail, push. Removing 8080 means rewriting all of them, not just login.

8080 is not extra work you are being asked to do twice — it is the application server,
and it is already built, configured and one correct build away from running. Your
`.env` is now valid and steps 1-6 of the deploy script pass; this build swap is the
last item.

## Repo changes in this plan

No application code. Deployment tooling only, so this exact dead end cannot repeat:

1. `scripts/collect-dist.mjs`: emit `dist/build-info.json` recording which pass built
   the bundle (`node-server` vs worker) and when.
2. `scripts/deploy-frontend.sh` step 4: read that marker (falling back to scanning
   `server/index.mjs` for a listener on older folders) and stop immediately with
   "this dist/ is a worker build — rebuild with `npm run build:selfhost`", instead of
   starting pm2 and running a 40-attempt curl loop.
3. The generated `dist/start.mjs`: after importing the bundle, detect that no listener
   was opened and exit with that same message rather than printing a success banner
   and quitting silently — the behaviour that cost you today.
4. `scripts/deploy-frontend.sh` step 7: on timeout, print the last 30 lines of
   `pm2 logs Qty_App` automatically.
5. `DEPLOY-QUALITY.md`: a short "process starts, port never opens" entry naming the
   worker-vs-node build as the first thing to check, and `build:selfhost` marked as
   required for this server.

Nothing touches the SAP middleware on 3002, nginx, Docker or the database.

## Security follow-up

The service-role key was pasted into chat and the middleware secret is `123456`. Once
login works, rotate the key and set a long random secret in both `frontend/.env` and
`middleware/.env`.
