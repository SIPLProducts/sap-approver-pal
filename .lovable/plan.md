# Session handling: tab-session marker + 30-minute idle timeout

Only session handling changes. Approval, SAP, permission logic, the login form design, and `src/integrations/supabase/client.ts` stay as they are. All current code stays; the changes are small additions.

## What users will notice
- Closing the browser or tab and opening the app again sends them to the login page instead of signing them back in.
- After 30 minutes with no mouse, keyboard, touch or scroll activity in any open tab, they are signed out and sent to the login page. Activity in one tab keeps the other tabs signed in.

## Changes

1. **New helper `src/lib/auth/session-guard.ts`** (new file only)
   - `markSessionActive()` sets sessionStorage `app.sessionActive = "1"`.
   - `hasSessionMarker()` reads the marker.
   - `forceSignOut()` does the same steps as the current Sign out: `setSapProfile(null)`, removes `app.activePlants`, `app.activePlant`, `app.activeRole` from localStorage, calls `supabase.auth.signOut()`, then removes the marker.
   - `IDLE_MS = 30 * 60 * 1000`, `LAST_ACTIVITY_KEY = "app.lastActivity"`.

2. **`src/routes/login.tsx`** (logic only, form unchanged)
   - Call `markSessionActive()` just before `nav({ to: "/inbox" })` in both the email sign-in and SAP sign-in paths. Also write `app.lastActivity = now`.
   - In the existing `getSession` check on mount: if a session exists but the marker is missing, call `forceSignOut()` and stay on `/login`; otherwise keep the current redirect to `/inbox`.

3. **`src/routes/index.tsx`** (`beforeLoad`)
   - If a session exists and the marker is present, redirect to `/inbox` as now. If a session exists but the marker is missing, `await forceSignOut()` and redirect to `/login`. No session: `/login` as now.

4. **`src/routes/_authenticated.tsx`** (additions only)
   - Mount check: once the user is loaded, if the marker is missing, run `forceSignOut()` and `nav({ to: "/login", replace: true })`.
   - Idle timer in a `useEffect`:
     - Listen for `mousemove`, `mousedown`, `keydown`, `touchstart`, `scroll` (passive). Write `app.lastActivity = Date.now()` to localStorage, at most once every 5 seconds.
     - A `storage` event listener picks up activity from other tabs.
     - Check every 30 seconds (and on `visibilitychange`). If `now - lastActivity >= 30 min`, run `forceSignOut()` and go to `/login`. Because every tab reads the same localStorage timestamp, all tabs time out together.
   - The current `logout()` function stays as it is. It will also clear the marker as a small extra line.

## Technical notes
- sessionStorage is per tab, so a newly opened tab has no marker. To keep "open in new tab" working, a new tab copies the marker when `app.lastActivity` in localStorage is recent (under 30 minutes) and a session exists. Tabs reopened after closing the browser get signed out, as long as the last activity is old. If you want the strict version instead (every new tab must sign in again), tell me.
- Add a small test `src/lib/auth/session-guard.test.ts`: it checks that the idle limit is exactly 30 minutes and that "expired" is calculated correctly.
