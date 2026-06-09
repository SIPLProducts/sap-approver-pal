## Goal
Ensure "Users & Roles" and "SAP API Settings" appear in the sidebar for admin users, and make the gate resilient to stale caches / RLS edge cases.

## Findings
- Your account `admin@demo.app` (`62e29efb-5081-4d1a-ab78-40db72c7d09c`) already has `Admin` in `public.user_roles`.
- `src/routes/_authenticated.tsx` already renders both links when `roles?.includes("Admin")` is true.
- Most likely the React Query cache for `["roles", user.id]` is stale, or the sidebar `roles` read is racing the session refresh — so `isAdmin` evaluates `false` on first render and never re-fetches.

## Changes (frontend only, no schema work)

1. **Switch the role check to the canonical RPC** in `_authenticated.tsx`
   - Replace the direct `from("user_roles").select(...)` with `supabase.rpc("has_role", { _user_id: user.id, _role: "Admin" })`.
   - `has_role` is `SECURITY DEFINER` (already in DB), so it bypasses any RLS surprise on `user_roles` and returns a single boolean — faster and more reliable than the array read.
   - Keep a second query for the badge list, but separate the admin gate so an empty/failed list never hides admin links.

2. **Refresh on auth events**
   - Subscribe once to `supabase.auth.onAuthStateChange` and call `qc.invalidateQueries({ queryKey: ["isAdmin"] })` on `SIGNED_IN` / `TOKEN_REFRESHED` so a freshly-granted role appears without a hard reload.

3. **Stale-cache safety**
   - Set `staleTime: 0` and `refetchOnWindowFocus: true` on the `isAdmin` query.

4. **Visible diagnostic for admins missing links**
   - In the sidebar footer, when `isAdmin === false` but the badge list contains `Admin`, show a tiny "Refresh roles" link that calls `qc.invalidateQueries()`. Helps if the situation recurs.

## Out of scope
- No DB migration (role already present).
- No new tables, no policy changes.
- Admin pages themselves (`admin.users`, `admin.sap-api.*`) are untouched.

## Files
- `src/routes/_authenticated.tsx` — swap role query to RPC, add auth-state listener for cache invalidation, add refresh affordance.
