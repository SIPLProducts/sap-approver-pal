## Goal
Show only a single demo account on the login page, and ensure that account has access to every screen/feature.

## Changes

### 1. `src/routes/login.tsx`
In the "Demo accounts" panel, replace the 4-button grid with a single "Admin" demo button:
- User ID: `admin@demo.app`
- Password: `Demo@1234`

Keep the panel styling and helper text ("password Demo@1234"); just render one full-width button instead of the 2×2 grid.

### 2. Ensure the demo admin has full access
The `admin@demo.app` user already receives full access via two existing mechanisms:
- `handle_new_user()` DB trigger grants the built-in `Admin` role to the first signup.
- `assertScreen` / `assertAnyScreen` in `src/lib/admin/assert-screen.ts` short-circuits to allow every screen when the user has the built-in `Admin` role (`isBuiltInAdmin`).
- `useIsBuiltInAdmin` unlocks all client-side screen gates for built-in admins.

Action: verify `admin@demo.app` exists in `auth.users` and has a row in `public.user_roles` with role `Admin`. If missing, insert the `Admin` role for that user via a migration (idempotent `INSERT ... ON CONFLICT DO NOTHING`, scoped by `user_id` looked up from `auth.users` by email). No app code needed beyond that — the built-in Admin path already grants access to every screen.

No other demo users will be seeded or referenced.

## Out of scope
- No changes to permission logic, screen keys, or SAP profile handling.
- No visual redesign of the login page beyond replacing the demo buttons.
