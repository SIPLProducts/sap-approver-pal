# Next: find out why the started process never binds 8080

Progress is real — `.env` is now valid and steps 1-6 all pass, so the env problem is
closed. The remaining fact: pm2 starts `Qty_App`, but nothing ever listens on 8080.
That means the process either exits immediately or boots a bundle that does not start
an HTTP listener. Two read-only checks settle it.

## Check A — run the launcher in the foreground

pm2 hides the failure. This prints it:

```bash
cd /data/webapplication/resl_approval/Quality/frontend/dist
PORT=8080 HOST=127.0.0.1 node start.mjs
```

Healthy output: `[start] loaded env from .env.runtime`, an `env present:` line, a
listening line, and the command stays running. A stack trace, or an immediate return
to the prompt, is the answer.

Equivalent from pm2, if you prefer: `pm2 logs Qty_App --lines 60 --nostream`.

## Check B — is this dist/ actually the self-host build?

Most likely cause. `npm run build` produces a Cloudflare worker bundle, which exports
a fetch handler and opens **no port**; only `npm run build:selfhost` produces a Node
HTTP server. Both leave a `server/index.mjs`, so step 4 of the deploy script cannot
tell them apart today.

```bash
cd /data/webapplication/resl_approval/Quality/frontend/dist
grep -c -E 'createServer|\.listen\(' server/index.mjs
grep -c -E 'cloudflare|workerd' server/index.mjs
```

A worker bundle scores 0 on the first command. The fix in that case is to rebuild on
your build machine with `npm run build:selfhost` and copy the whole `dist/` again —
no server-side change needed.

Also from your pm2 output: `/var` is 95.4% full. Free space there if the foreground
run complains about writes.

## Repo changes this plan makes

No application code. Three deployment-tooling fixes so this failure reports itself:

1. `scripts/collect-dist.mjs`: write `dist/build-info.json` recording whether the
   bundle came from the self-host (`node-server`) or worker pass, plus a timestamp.
2. `scripts/deploy-frontend.sh` step 4: read that marker and stop with a clear
   message — "this dist/ is a worker build, rebuild with `npm run build:selfhost`" —
   instead of proceeding into a 40-attempt curl loop. If the marker is absent (older
   dist), fall back to scanning `server/index.mjs` for a listener.
3. `scripts/deploy-frontend.sh` step 7: on timeout, automatically print the last 30
   lines of `pm2 logs Qty_App` and shorten the wait, so the cause is visible without
   another round trip.

`DEPLOY-QUALITY.md` gains a matching entry: process starts, port never opens —
worker-vs-node build is the first thing to check.

## What I need from you

Paste the output of Check A and Check B. If Check B shows a worker build, rebuild with
`npm run build:selfhost`, re-copy `dist/`, re-run `bash deploy-frontend.sh` — that
alone should bring 8080 up and clear the 502.

Nothing here touches the SAP middleware on 3002, nginx, Docker or the database.

## Security follow-up

The service-role key was pasted into chat and the middleware secret is `123456`. Once
login works, rotate the key and replace the secret with a long random value in both
`frontend/.env` and `middleware/.env`.
