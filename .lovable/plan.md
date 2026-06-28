# Replace Work Email with User ID on Login

## Scope
Frontend-only change to `src/routes/login.tsx`. The sign-in flow already calls SAP `Login_API` with the entered value as `USER`, so swapping the label/field is sufficient.

## Changes — `src/routes/login.tsx`

- Rename state `email` → `userId` (and setter).
- Replace the "Work email" `<Label>` + `<Input type="email">` block with:
  - Label: "User ID"
  - Input: `type="text"`, `autoComplete="username"`, no email validation.
- Update `submit()` to pass `username: userId` to `sapLoginFn`.
- Sign-up branch (still Supabase) currently uses `email`. Since this form no longer collects an email, hide/disable the "Sign up" toggle on this page to avoid a broken signup. (Alternatively keep signup but it would need an email field — confirm if you'd rather keep both. Default: hide the toggle.)
- Demo account buttons currently set `setEmail(a.email)`; update them to `setUserId(a.email)` so they still prefill the field with the demo identifier.
- Remove the now-unused `supabase` import only if signup is removed; otherwise keep it.

No backend, schema, or SAP config changes.
