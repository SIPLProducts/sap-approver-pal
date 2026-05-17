## Demo accounts to seed

Create 4 demo users in Lovable Cloud auth + profiles + user_roles, covering each role in the approval flow. Password is the same for all so it's easy to demo.

**Accounts** (password: `Demo@1234`)

| Email | Name | Role | Purpose |
|---|---|---|---|
| admin@demo.app | Aisha Khan | Admin | Manages strategies, users, integrations |
| manager@demo.app | Rahul Verma | Manager | First-level approver |
| finance@demo.app | Priya Shah | Finance | Second-level approver |
| requester@demo.app | Karan Mehta | Requester | Raises documents |

(If you want different roles/names/emails, tell me and I'll adjust.)

## How it gets created

A single migration that:
1. Inserts 4 users into `auth.users` with encrypted password `Demo@1234` and `email_confirmed_at = now()` (so they can sign in immediately without email verification).
2. Relies on the existing `handle_new_user` trigger to populate `public.profiles`.
3. Inserts matching rows into `public.user_roles` mapping each user to their `app_role`.

## After it runs

- Go to `/login`, use any email above with `Demo@1234`.
- A small "Demo accounts" helper panel will be added to the login page (sign-in mode only) with one-click fill buttons for each account — purely a UI convenience, no logic change.

## Out of scope

- No seed approval documents yet (let me know if you also want sample inbox data).
- No Google OAuth wiring for these accounts — password login only.
