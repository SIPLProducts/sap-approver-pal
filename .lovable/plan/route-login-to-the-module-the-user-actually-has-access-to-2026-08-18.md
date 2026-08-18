# Route login to the module the user actually has access to

Today, after sign-in the app always lands on `/inbox`, and `/inbox` unconditionally forwards to the MM inbox (`/inbox/mm`). An SD-only user therefore sees the MM Approvals dashboard even though the sidebar correctly hides all MM entries.

## What changes

1. **Make the post-login landing permission-aware.** The `/inbox` entry route stops hard-coding MM. It waits for permissions to load, then sends the user to:
   - MM inbox if they have MM access,
   - otherwise the SD Approvals dashboard if they have SD access,
   - otherwise the first screen they are allowed to see (e.g. History / Users & Roles / Settings) so an admin-only user is not dropped on a blank page.

2. **Guard the module inbox.** Opening `/inbox/mm` without MM access (bookmark, back button, or old link) redirects to the user's allowed landing target instead of rendering the MM dashboard.

Everything else — permission rules, sidebar filtering, SAP calls, screen logic — stays exactly as it is.

## Technical notes

- `src/routes/_authenticated/inbox.index.tsx`: replace the static `redirect` in `beforeLoad` with a small component that reads `usePermissions()` (already used by the authenticated layout), shows the existing "Loading…" state while `perms.loading`, and then `navigate({ replace: true })` to the resolved target. Permissions are derived client-side from the SAP profile, so this must be resolved in the component, not in `beforeLoad`.
- Resolution order lives in one small helper in that file: `approvals.inbox.mm` → `/inbox/mm`; `approvals.inbox.sd` → `/sd/dashboard`; then fall back over `approvals.history`, `admin.users`, and finally `/settings`.
- `src/routes/_authenticated/inbox.$module.tsx`: keep the existing `notFound()` check for unknown modules; add a component-level check that redirects when `can("approvals.inbox.mm")` / `can("approvals.inbox.sd")` is false for the requested module.
- `src/routes/login.tsx` and `src/routes/index.tsx` keep navigating to `/inbox`; the new entry route does the routing, so no duplicated permission logic.
