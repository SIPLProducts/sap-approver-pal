## Goal
After a SAP login, load the user's assigned roles/permissions and render only the sidebar entries and routes the user is allowed to access.

## Root cause
Two problems compound:

1. **SAP login ignores admin-provisioned profiles.** `sapLogin` (in `src/lib/auth/sap-login.functions.ts`) always creates/looks up an auth user by a synthetic email (`<sapid>@sap-login.invalid`). If an admin had already created the user in `admin/users` (which stores `sap_user_id` on `profiles` and rows in `user_roles` / `user_custom_roles`), SAP login creates a *new* auth user with no roles, so `user_roles` is empty after login.
2. **Sidebar gating uses only `roles.includes("Admin")`.** `src/routes/_authenticated.tsx` shows MM/SD/History/Settings to everyone and Admin-only items only to Admins. There is no mapping from sidebar items to `role_permissions.screen_key`, and custom roles (via `user_custom_roles` → `role_permissions`) are not consulted at all.

## Plan

### 1. Match SAP user to the pre-provisioned profile (server)
File: `src/lib/auth/sap-login.functions.ts`

- Before creating any synthetic auth user, look up `profiles` by `sap_user_id = <login id>` (case-insensitive). If found:
  - Reuse that profile's `id` as the auth user id.
  - If no `auth.users` row exists for that id yet, create one via `admin.createUser` with the profile's real email (or a synthetic one if missing), passing `id` so it matches the profile.
  - Do not overwrite existing `full_name`, `email`, `status` on the profile — only fill blanks.
- Only when there is no existing profile with that `sap_user_id`, fall back to the current synthetic-email flow (and stamp `sap_user_id` on the new profile).
- Continue to return `{ email, tokenHash }` so the browser can `verifyOtp` and get a real Supabase session — that session will now carry the right `auth.uid()` and therefore the right `user_roles` / `user_custom_roles`.

### 2. Resolve effective permissions for the signed-in user (client)
New hook: `src/hooks/use-permissions.ts`

- Inputs: current `user.id`.
- Queries (parallel, cached via React Query):
  - `user_roles` → built-in roles
  - `user_custom_roles` → custom role ids
  - `role_permissions` filtered to those built-in roles and custom role ids, `allowed = true`
- Output:
  ```ts
  {
    loading: boolean,
    roles: AppRole[],
    isAdmin: boolean,
    allowedScreens: Set<string>,        // screen_keys where any allowed=true
    can: (screen, action='view') => boolean,
  }
  ```
- `Admin` short-circuits to "all screens allowed" (keeps current admin behaviour).

### 3. Map sidebar items to screen keys and filter
File: `src/routes/_authenticated.tsx`

- Tag every nav entry with a `screen` key from `src/lib/admin/screen-keys.ts`:
  - MM Approvals → `approvals.inbox.mm`
  - SD parent visible if any of `approvals.inbox.sd` allowed; each SD child also tagged `approvals.inbox.sd` (single screen in current taxonomy).
  - History → `approvals.history`
  - Users & Roles → `admin.users`
  - Release Strategies → `admin.strategies`
  - SAP API Settings → `sap.api_settings`
  - Integrations → `sap.integrations`
  - Settings → always visible (personal settings, no screen gate).
- Use `usePermissions()`; while `loading`, render the sidebar skeleton (no flicker of admin items). After load, filter items by `can(screen, 'view')`.
- Remove the ad-hoc `isAdmin` check; admin items appear naturally because Admin grants all screens.

### 4. Route-level guard for direct URL access
New pathless layout: `src/routes/_authenticated/_perm.tsx` is NOT used (would require restructuring). Instead, add a small `<RequirePermission screen="..." />` wrapper component and use it inside each protected page's component (MM inbox, SD pages, History, Admin pages). If denied, show a friendly "You don't have access to this screen" card with a link back to an allowed landing route.

- Also update `src/routes/index.tsx` redirect: instead of always sending to `/inbox/mm`, send to the first allowed screen (MM → SD → History → Settings) so users without MM still land somewhere they can see.

### 5. Notes / out of scope
- No DB schema changes; existing `user_roles`, `user_custom_roles`, `role_permissions` are sufficient.
- The Node middleware is not touched.
- Action-level gating (create/edit/delete buttons) is exposed via `can(screen, action)` but only wired into the sidebar/route gate in this change; per-button gating can be a follow-up.

## Technical details

- All queries scoped by `auth.uid()` via existing RLS on `user_roles`, `user_custom_roles`, `role_permissions`.
- `usePermissions` uses `useQuery` with `enabled: !!user`, `staleTime: 60_000`, and invalidates on `supabase.auth` `SIGNED_IN` / `SIGNED_OUT` events (extending the existing channel subscription).
- SAP login profile match uses `supabaseAdmin.from('profiles').select('id,email').ilike('sap_user_id', loginId).maybeSingle()` and `admin.createUser({ id, email, email_confirm: true })` when the auth row is missing.
- Generated magic link works for either case because `generateLink` is keyed on `email`, which we now align with the existing profile.
