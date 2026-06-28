## Goal

When a user signs in through Lovable Cloud (Google / email — not SAP), they currently have no SAP profile cached, so the sidebar shows nothing and every screen-gated action is blocked. Make those users see every screen and have every action enabled, without hardcoding role names anywhere.

## Approach

Treat "signed in via Cloud with the built-in `Admin` role" as a synthetic SAP context that grants every screen activity. Drive it from the existing `screen-keys.ts` registry — no role-name strings anywhere else.

### Client

1. **New hook `useIsBuiltInAdmin`** (`src/hooks/use-is-builtin-admin.ts`)
   - Calls the existing `has_role(auth.uid(), 'Admin')` RPC via the browser Supabase client.
   - Returns `{ loading, isAdmin }`. Cached via TanStack Query so the sidebar doesn't refetch.

2. **Synthetic profile in `useActiveContext`** (`src/hooks/use-active-context.tsx`)
   - If `useSapProfile()` returns `null` AND `useIsBuiltInAdmin()` is `true`, build a synthetic profile:
     - One plant `{ code: "ALL", name: "All Plants", roles: [{ role: "ADMIN", label: "Administrator", activities: ALL_SCREENS.map(s => s.activity) }] }`.
   - Everything downstream (`plants`, `roles`, `activeActivities`, `usePermissions.can`, sidebar visibility) then works unchanged.
   - SAP-authenticated users are unaffected because the synthetic profile only kicks in when the cached SAP profile is absent.

### Server

3. **`assertScreen` / `assertAnyScreen`** (`src/lib/admin/assert-screen.ts`)
   - Already passes when the user has the built-in `Admin` user_role. Tighten the "SAP not loaded" branch so it only throws when the user is also not a built-in Admin (otherwise just allow). This makes Cloud-only admins able to invoke every server function.

4. **Auto-grant `Admin` on first Cloud sign-in** (migration)
   - Update the `handle_new_user` trigger to also insert `('Admin')` into `public.user_roles` for the new `auth.users` row when the table is empty (first user) — keep current behavior otherwise. This avoids requiring a manual SQL step to bootstrap the first Google admin.
   - No new tables, no GRANT changes needed (user_roles GRANTs already exist).

## Non-goals / guarantees

- No role-name hardcoding in screen logic — the synthetic profile is built from `ALL_SCREENS`, and screen access still flows through `activityToScreenKey`.
- SAP login flow, role-switcher, and custom-role permission matrix are untouched.
- No changes to `screen-keys.ts`, `usePermissions`, or the sidebar.

## Files to change

- `src/hooks/use-is-builtin-admin.ts` (new)
- `src/hooks/use-active-context.tsx` (inject synthetic profile)
- `src/lib/admin/assert-screen.ts` (allow built-in Admin even when SAP profile missing — already mostly there; remove the misleading "sign out" error for admins)
- New migration: extend `handle_new_user` to bootstrap the first user as `Admin`

## Validation

- Sign in via Google with no SAP profile → sidebar shows every module; opening Admin → Users & Roles loads and edit buttons work.
- Existing SAP user with cached profile → behavior unchanged (synthetic profile not used).
- Switching roles in top bar for SAP user → still reactive (no regression).
