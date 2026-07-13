Remove the demo account block from the login page so only SAP-based authentication is presented.

### Scope
- File: `src/routes/login.tsx`

### Changes
1. Delete the entire "Demo account" panel rendered under `{mode === "signin" && (...)}` at the bottom of the sign-in column (the `<div className="mt-8 rounded-xl border bg-secondary/40 p-4">…</div>` block containing the Admin quick-fill button).
2. No other logic, styling, or auth-flow changes. SAP login via `sapLogin` + Supabase magic-link verification remains the sole path.
