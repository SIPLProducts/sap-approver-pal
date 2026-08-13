# Fix "Missing SUPABASE_PUBLISHABLE_KEY" on the Quality login page

## What you're seeing

The page renders the SSR error shell with:

```text
Missing Supabase environment variable(s): SUPABASE_PUBLISHABLE_KEY.
```

That message comes from the app's Supabase client, which needs a publishable
(anon) key. On the Quality box it is looking for either the value compiled into
the browser bundle at build time (`VITE_SUPABASE_PUBLISHABLE_KEY`) or the
server-side `SUPABASE_PUBLISHABLE_KEY` in `dist/.env.runtime` — and neither is
present.

## Where it was missed

The publishable key is treated as optional everywhere in the pipeline, so a
build with the key absent completes "successfully" and only fails in the
browser:

- the build's env-baking step lists `SUPABASE_PUBLISHABLE_KEY` as expected but
  only warns (not fails) when `SUPABASE_URL`, service-role, and middleware keys
  are missing — the publishable key is not in the must-have set at all
- the app-server launcher's required-value check contains only `SUPABASE_URL`
  and `SUPABASE_SERVICE_ROLE_KEY`
- the server deploy script validates only `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `MIDDLEWARE_URL`, `MIDDLEWARE_SHARED_SECRET`
- the dist verifier boots the server but does not check that the rendered
  login page is free of the Supabase-config error

## Immediate fix on your server (no rebuild needed to test)

1. In the frontend folder's `.env`, add the anon/publishable key from your
   self-hosted `supabase/.env` (the `ANON_KEY` value), as both names:
   `SUPABASE_PUBLISHABLE_KEY=...` and `VITE_SUPABASE_PUBLISHABLE_KEY=...`
2. Rebuild (`npm run build:selfhost`) so the browser bundle also carries the
   key, redeploy the whole `dist/`, then `cd dist && bash deploy-frontend.sh`.

A `.env.runtime`-only edit fixes the server render but the browser bundle still
needs the `VITE_` value baked in at build time, so the rebuild is required.

## Code changes so this can never ship silently again

1. `scripts/collect-dist.mjs`
   - add `SUPABASE_PUBLISHABLE_KEY` to the must-have key list (accepting the
     `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_ANON_KEY` aliases already
     defined there)
   - make a missing must-have key **fail the build** with an explicit message
     naming the file to edit, instead of printing a warning
2. Launcher generated into `dist/start.mjs` (same script)
   - add `SUPABASE_PUBLISHABLE_KEY` to `REQUIRED` so the app server refuses to
     start with a blank key rather than serving the error page
3. `scripts/deploy-frontend.sh`
   - add `SUPABASE_PUBLISHABLE_KEY` to the validated key loop in step 3, with a
     message pointing at `frontend/.env` and the Supabase `ANON_KEY`
4. `scripts/verify-dist.mjs`
   - after the boot test, fetch `/login` and fail if the HTML contains
     `Missing Supabase environment variable` or `Something went wrong`, so a
     misconfigured bundle is caught locally before you copy it to Quality
5. `.env.quality.example` / `.env.prod.example`
   - list both `SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_PUBLISHABLE_KEY`
     with a note that the value is the self-hosted `ANON_KEY`

## Notes

- No application/UI code changes; this is build, launcher, and deploy
  validation only.
- The service-role key stays server-only; the publishable/anon key is safe in
  the browser bundle.
