# Reusing the Quality ANON_KEY / SERVICE_ROLE_KEY in Production

## Will it work?

Yes, technically — as long as Production's `JWT_SECRET` is **exactly the same** as Quality's. Those keys are HS256 JWTs signed with `JWT_SECRET`; Kong/GoTrue/PostgREST verify the signature against the secret in `Production/backend/.env`. Same secret + same keys = the stack starts and the app logs in.

If you paste Quality's keys but generate a *new* Production `JWT_SECRET`, everything breaks with `invalid JWT` / `JWSError` — Kong rejects every request and login fails.

## What you give up

One shared secret means the two environments trust each other's tokens:

- A Quality anon/service token is accepted by Production, and vice-versa.
- Anyone who has the Quality key (it is already in a Quality `.env`, in build output, and in your chat history) automatically holds a valid Production service-role key — which bypasses RLS on Production data.
- Rotating a leaked key forces both environments down at the same time.

Nothing in the app code cares; this is purely a security boundary question.

## Recommendation

- Fine for a short-lived cutover / smoke test: keep the same `JWT_SECRET` + keys and move on.
- Before Production carries real approval data: generate a fresh `JWT_SECRET` for Production and mint new `ANON_KEY` / `SERVICE_ROLE_KEY` from it (the mint script is in `supabase/README.md`), then update `Production/backend/.env` and `Production/frontend/.env` together — the anon key appears in both, and the frontend must be rebuilt so the browser bundle picks up `VITE_SUPABASE_PUBLISHABLE_KEY`.

Also unrelated but still worth fixing in the Production frontend `.env`: no space before `=` on `VITE_SUPABASE_PUBLISHABLE_KEY`, and `NODE_ENV=production` in lowercase.

## Repo changes needed

None. `deploy/production/backend/.env.example` already carries the `CHANGE_ME_*` placeholders and the warning; you just decide which values to paste.
