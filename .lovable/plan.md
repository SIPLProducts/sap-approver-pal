# Production frontend `.env` — review

Yes: the Production frontend `.env` is the same file as Quality, only the values differ (Kong port 8010, middleware 3010, app port 8090, and its own keys). Three things in what you pasted must be corrected.

## 1. Remove the space before `=`

`VITE_SUPABASE_PUBLISHABLE_KEY =...` is parsed as the variable `VITE_SUPABASE_PUBLISHABLE_KEY ` (with a trailing space), so the browser bundle is built without the key and the app shows "Missing Supabase environment variable(s): SUPABASE_PUBLISHABLE_KEY". No spaces around `=` anywhere.

## 2. `NODE_ENV` must be lowercase `production`

The build writes `NODE_ENV` straight through to `dist/.env.runtime` and the pm2 config. `Production` is not a value React/Vite recognise, so the app server would run the development React runtime (slower, dev warnings). Use `NODE_ENV=production`.

## 3. The keys are still the Quality keys

The anon and service-role JWTs you pasted are byte-identical to Quality, i.e. both stacks share one `JWT_SECRET`. A Quality token would then be accepted by Production. Recommended: generate a fresh Production `JWT_SECRET` in `Production/backend/.env` and mint new `ANON_KEY` / `SERVICE_ROLE_KEY` from it, then paste those here. Also use a real random `MIDDLEWARE_SHARED_SECRET` instead of `123456` (must match the Production middleware `.env` and the Proxy Secret in Admin → SAP API Settings).

## Corrected file

```text
PORT=8090
HOST=127.0.0.1
NODE_ENV=production

SUPABASE_URL=http://10.150.150.130:8010
SUPABASE_PUBLISHABLE_KEY=<PROD ANON_KEY>
SUPABASE_ANON_KEY=<PROD ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<PROD SERVICE_ROLE_KEY>
SUPABASE_PROJECT_ID=Production

VITE_SUPABASE_URL=http://10.150.150.130:8010
VITE_SUPABASE_PUBLISHABLE_KEY=<PROD ANON_KEY>
VITE_SUPABASE_PROJECT_ID=Production

MIDDLEWARE_URL=http://127.0.0.1:3010
MIDDLEWARE_SHARED_SECRET=<long random, different from Quality>
MIDDLEWARE_TIMEOUT_MS=60000
```

Note `SUPABASE_ANON_KEY` and `MIDDLEWARE_TIMEOUT_MS` were missing from your paste; the repo template `deploy/production/frontend/.env.example` already has this exact shape.

## What I would change in the repo

Nothing is required — the existing template already matches. If you want, I can add a hard build-time check that rejects `NODE_ENV` values other than `production`/`development` and keys with surrounding whitespace, so a mistyped `.env` fails the build instead of producing a broken `dist/`.
