# Quality login: "Missing SUPABASE_PUBLISHABLE_KEY" — confirm the cause, then fence it off

Your `frontend/.env` does contain both `SUPABASE_PUBLISHABLE_KEY` and
`VITE_SUPABASE_PUBLISHABLE_KEY`, so the file itself is not the problem. That
means the key is not reaching the running app server — and there are three
places it can get lost. The cause is not yet confirmed, so step 1 is a
30-second check on the server, not a code change.

## How the key is supposed to travel

```text
frontend/.env
   |  (deploy-frontend.sh step 3 copies it)
   v
dist/.env.runtime
   |  (dist/start.mjs loads it into process.env)
   v
app server on 8080  ->  SSR reads process.env.SUPABASE_PUBLISHABLE_KEY
   |  (build time only)
   v
browser bundle      <-  VITE_SUPABASE_PUBLISHABLE_KEY baked by `npm run build:selfhost`
```

## Step 1 — three commands on the Quality box

```bash
cd /data/webapplication/resl_approval/Quality/frontend
grep -c '^SUPABASE_PUBLISHABLE_KEY=' dist/.env.runtime      # expect 1
grep -o '^SUPABASE_PUBLISHABLE_KEY=.\{0,12\}' dist/.env.runtime
pm2 logs Qty_App --lines 40 --nostream | grep '\[start\] env'
```

The launcher prints `[start] env present: …` and `[start] env absent: …` on
every boot. Which list contains `SUPABASE_PUBLISHABLE_KEY` tells us the answer:

- **absent in `dist/.env.runtime`** — the running `dist/` predates the `.env`
  edit; re-run `cd dist && bash deploy-frontend.sh` to regenerate it.
- **present in `.env.runtime` but listed as absent by `[start]`** — the pm2
  process is an old one holding stale env: `pm2 restart Qty_App --update-env`.
- **listed as present, yet `/login` still errors** — then the failing read is
  the browser bundle, i.e. the deployed `dist/` was built on a machine where
  `VITE_SUPABASE_PUBLISHABLE_KEY` was not set. Fix: rebuild on the Quality box
  (or any machine whose `.env` has the `VITE_` line) with
  `npm run build:selfhost` and replace the whole `dist/`.

Send me the output of those three commands and I will confirm which branch it
is before any code is touched.

## Step 2 — code changes so this cannot silently ship again

Regardless of which branch it turns out to be, the pipeline currently lets a
build with no publishable key pass every gate and fail only in the browser:

1. `scripts/collect-dist.mjs`
   - treat `SUPABASE_PUBLISHABLE_KEY` (accepting the existing
     `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_ANON_KEY` aliases) as a
     must-have when baking `dist/.env.runtime`, and **fail the build** instead
     of warning when a must-have is empty
   - also fail when `VITE_SUPABASE_PUBLISHABLE_KEY` was not available at build
     time, since that value can only be baked in, never fixed on the server
2. the launcher generated into `dist/start.mjs` (same script)
   - add `SUPABASE_PUBLISHABLE_KEY` to its `REQUIRED` list, so the app server
     refuses to start rather than serving "Something went wrong"
3. `scripts/deploy-frontend.sh`
   - add `SUPABASE_PUBLISHABLE_KEY` to the validated keys in step 3
   - in step 7, fail the run when the fetched `/login` HTML contains
     `Missing Supabase environment variable`, and print the launcher's
     `[start] env absent` line so the cause is on screen
4. `scripts/verify-dist.mjs`
   - after the boot test, fail when `/login` HTML contains
     `Missing Supabase environment variable` or `Something went wrong`
5. `.env.quality.example` / `.env.prod.example`
   - document both names, noting the value is the self-hosted `ANON_KEY` and
     that the `VITE_` one is required **at build time**

## Notes

- No UI or business-logic changes; build, launcher, and deploy validation only.
- `SUPABASE_SERVICE_ROLE_KEY` stays server-side; the publishable/anon key is
  meant to be in the browser bundle.
