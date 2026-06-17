## Skip landing page — go straight to login

Make the root URL `/` send users directly to the auth flow instead of rendering the marketing landing page shown in the screenshot.

### Change

**`src/routes/index.tsx`** — Replace the landing page with a redirect:
- Authenticated users → `/inbox` (existing post-login destination)
- Unauthenticated users → `/login`

Implemented in the route's `beforeLoad` using `throw redirect({ to: ... })`, checking the current Supabase session. No component render needed.

### Out of scope

- Landing page content/components are left in place but unused; not deleted in case it's wanted later.
- `/login` page itself is unchanged.

### Verification

Visit `/` while signed out → lands on `/login`. Visit `/` while signed in → lands on `/inbox`.
