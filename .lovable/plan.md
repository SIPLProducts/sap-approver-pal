# One .env in the frontend folder — no second file to maintain

## Why a server-side .env is needed at all

Your VS Code `.env` splits into two groups when you run `npm run build`:

- `VITE_*` values are **baked into the built JavaScript**. They ship inside `dist/` and need nothing on the server.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MIDDLEWARE_URL`, `MIDDLEWARE_SHARED_SECRET` are **secrets**. They are deliberately *not* bundled — if they were, anyone opening the site could read your service-role key and your middleware secret. The app server (port 8080) reads them from the environment when it starts.

So the build cannot carry them. Something on the server has to supply them once. That is the only reason a file exists there.

## What changes

You keep maintaining exactly one file: `frontend/.env` on the server (same keys as your VS Code `.env`). The helper script reads it and stops asking you to fill a second file.

```text
frontend/
  .env          <- you maintain this one (server secrets)
  dist/         <- replaced on every deploy, nothing to edit inside
    deploy-frontend.sh
    start.mjs
```

Run, after copying a fresh `dist/`:

```bash
cd /data/webapplication/resl_approval/Quality/frontend/dist
bash deploy-frontend.sh
```

The script will now:
1. Look for `../.env` (the frontend folder). If found, generate `.env.runtime` from it automatically on every run — you never edit `.env.runtime` again.
2. Only fall back to the template + stop-and-ask behaviour when no `../.env` exists.
3. Re-check that the four required keys are non-empty, and name the missing ones.
4. Continue as before: install runtime deps into `.runtime/`, restart `Qty_App`, health-check port 8080, the backend route, and the middleware on 3002.

Because `dist/` is overwritten on each deploy, the secrets deliberately live one level up in `frontend/.env`, which the deploy never touches.

## Required keys in frontend/.env

From your screenshot you already have all of them:

```
SUPABASE_URL=http://10.150.150.130:8000
SUPABASE_SERVICE_ROLE_KEY=<service role key from supabase/.env>
MIDDLEWARE_URL=http://127.0.0.1:3002
MIDDLEWARE_SHARED_SECRET=123456   # must match middleware/.env exactly
```

`SUPABASE_PUBLISHABLE_KEY` is optional for the server (the browser gets it from the build), so the script will no longer block on it.

Note: `MIDDLEWARE_SHARED_SECRET=123456` is weak for a shared secret. Worth replacing with a long random value in both `frontend/.env` and `middleware/.env` once login is working.

## Technical details

- `scripts/deploy-frontend.sh`, step 3: prefer `../.env`, strip CR, append `PORT`/`HOST`/`NODE_ENV` when absent, write `dist/.env.runtime` with mode 600. Restore the required-keys validation loop (it was dropped by the previous edit) with the required set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MIDDLEWARE_URL`, `MIDDLEWARE_SHARED_SECRET`; treat `SUPABASE_PUBLISHABLE_KEY` as optional.
- Line-ending safety: the shipped copy is written with LF by `scripts/collect-dist.mjs`, and `.gitattributes` pins `*.sh` to LF, so the `sed -i 's/\r$//'` workaround is no longer needed.
- No application code, nginx, Docker, database or middleware changes.
