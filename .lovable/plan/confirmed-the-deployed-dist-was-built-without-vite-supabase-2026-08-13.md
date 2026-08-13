# Confirmed: the deployed `dist/` was built without `VITE_SUPABASE_PUBLISHABLE_KEY`

Your three checks settle it:

- `dist/.env.runtime` has `SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJI…`
- the launcher reports `[start] env present: … SUPABASE_PUBLISHABLE_KEY …`

So the **server** side has the key. The value that is missing is the one baked
into the **browser bundle** at build time. The Supabase client reads
`import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY` first and only falls back to
`process.env` — and `process.env` does not exist in a browser, so once the
baked value is empty the client throws exactly the message on your screen, and
the app renders its error boundary (unstyled, because it fails during boot).

In short: the `dist/` currently on the server was produced by a build run whose
`.env` did not contain `VITE_SUPABASE_PUBLISHABLE_KEY` (only the non-`VITE_`
names). Editing `.env` or `.env.runtime` afterwards cannot fix it — that value
is compiled in, not read at runtime.

## Step 1 — get Quality working now

On the machine where you build (the Quality box is fine, its `.env` already has
the `VITE_` lines):

```bash
cd /data/webapplication/resl_approval/Quality/frontend
grep '^VITE_SUPABASE' .env          # both VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be non-empty
rm -rf dist .output .wrangler
npm run build:selfhost
cd dist && bash deploy-frontend.sh
```

The rebuild is the fix; the fresh empty `dist/` prevents any mixing with the
current broken bundle.

## Step 2 — make this impossible to ship again

1. `scripts/build.mjs`
   - before either Vite pass, read `.env` / `.env.production` and abort with a
     clear message when `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY`
     is missing or empty, naming the file to edit and that the value equals the
     self-hosted `ANON_KEY`. This is the only gate that can catch a build-time
     value, so it must fail the build, not warn.
2. `scripts/collect-dist.mjs`
   - treat `SUPABASE_PUBLISHABLE_KEY` (accepting the existing
     `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_ANON_KEY` aliases) as a
     must-have when baking `dist/.env.runtime`, and fail instead of warning
   - add `SUPABASE_PUBLISHABLE_KEY` to the generated launcher's `REQUIRED`
     list so the app server never boots half-configured
   - scan the emitted `assets/*.js` for the baked publishable key and fail the
     build when no chunk contains it — this catches a bundle built with an
     empty `VITE_` value even if `.env` looked right
3. `scripts/verify-dist.mjs`
   - after the existing boot test, fail when the fetched `/login` HTML contains
     `Missing Supabase environment variable`
   - fail when no JS chunk contains the publishable key, using the same scan
4. `scripts/deploy-frontend.sh`
   - validate `SUPABASE_PUBLISHABLE_KEY` in step 3 alongside the other keys
   - in step 7, fail the run when `/login` contains
     `Missing Supabase environment variable`, and print the guidance that this
     specific failure means "rebuild — the browser bundle lacks the key"
5. `.env.quality.example` / `.env.prod.example`
   - list both names with a note that the `VITE_` pair is required **at build
     time** and the plain pair at runtime

## Notes

- No UI or business-logic changes; build, launcher, and deploy validation only.
- The publishable/anon key is designed to be visible in the browser bundle;
  the service-role key stays server-only and is never baked in.
