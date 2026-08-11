# Start the app server from inside `dist/` (second PM2 process)

## Why you ran into the error

You ran `npm install` and `pm2 start start.mjs` in `.../Quality/frontend`, but both files live one level down, in `.../Quality/frontend/dist`. That is exactly what the errors say: no `package.json` at `frontend/`, no `start.mjs` at `frontend/`. Your `dist/` listing confirms both are present inside it.

## Why the frontend still needs a process

This app is not a static site. `dist/index.html` + `assets/` are static, but every login and SAP call posts to `/_serverFn/*`, which is handled by the compiled app server in `dist/server/`. Nginx only forwards those requests — it cannot execute them. With nothing listening on 8080, Nginx answers 502 and login fails.

So the server needs two PM2 processes:

```text
browser -> Nginx :8081 -> static files from dist/            (no process)
                       -> /_serverFn/* , /api/*  -> :8080    <- app server  (MISSING today)
                                                     -> :3002 <- Qty_Approval middleware (already online)
```

`Qty_Approval` on 3002 is the SAP relay, a different job. It cannot answer `/_serverFn/*`.

## Exact commands

Run everything from inside `dist/`:

```bash
cd /data/webapplication/resl_approval/Quality/frontend/dist
npm install                 # installs wrangler only
```

Create `dist/.env.runtime` (the server process reads its own unprefixed vars):

```ini
PORT=8080
HOST=127.0.0.1
NODE_ENV=production
SUPABASE_URL=http://127.0.0.1:8000
SUPABASE_PUBLISHABLE_KEY=<ANON_KEY from backend/.env>
SUPABASE_ANON_KEY=<ANON_KEY from backend/.env>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from backend/.env>
MIDDLEWARE_SHARED_SECRET=<same secret the middleware uses>
```

Then start it and persist:

```bash
pm2 start start.mjs --name Qty_App --cwd /data/webapplication/resl_approval/Quality/frontend/dist
pm2 save
pm2 logs Qty_App --lines 40
```

## Verify

```bash
ss -ltnp | grep ':8080'                 # a listener must appear
pm2 ls                                  # TWO online: Qty_Approval + Qty_App
curl -i http://127.0.0.1:8080/          # any HTTP response, not "couldn't connect"
```

Then sign in as `22011840` in the browser; the middleware log should show `POST /login/Login_API`.

## Notes

- No rebuild is needed. The `dist/` you copied is correct; it just was never started.
- On future deployments: replace `dist/`, then `cd dist && npm install && pm2 restart Qty_App`. Keep `.env.runtime` (or copy it back after replacing the folder).
- Nginx needs no change if it already has `root .../frontend/dist;` plus `/_serverFn/` and `/api/` proxying to `127.0.0.1:8080`.
- No codebase change is required for this step.
