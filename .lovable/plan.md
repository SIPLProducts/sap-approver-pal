# Login_API on Sign-In

Wire the login form's "Sign in" button to invoke the SAP API named `Login_API` (configured in SAP API Settings) and gate navigation on its result. The existing Supabase password sign-in is removed from this submit handler per your direction.

## Scope

- Only the email-password "Sign in" button is changed.
- "Sign up" mode, Google OAuth, and demo-account buttons are left as-is.
- No schema or SAP API Settings UI changes.

## Backend — new server function

Create `src/lib/auth/sap-login.functions.ts` exporting `sapLogin`:

- `createServerFn({ method: "POST" })` (public — no `requireSupabaseAuth`, since users aren't signed in yet).
- Input (Zod): `{ username: string (1..200), password: string (1..500) }`.
- Handler:
  1. Load `sap_api_configs` row where `name = 'Login_API'` and `is_active = true` via `supabaseAdmin` (loaded inside the handler).
  2. If missing → return `{ ok: false, error: "Login_API is not configured in SAP API Settings" }`.
  3. Build payload: `{ LOGIN: { USER: username, PASSWORD: password } }`.
  4. If `auth_type === "proxy"` → call `invokeViaMiddleware(cfg.id, { LOGIN: { USER, PASSWORD } })` from `src/lib/sap/sap-client.server.ts`.
  5. Else → resolve URL via `resolveSapUrl(cfg.endpoint_url, sap_global_settings.sap_base_url)`, build Basic Auth header from `sap_global_settings.sap_username` + `sap_global_secrets.sap_password`, merge `extra_headers`, `fetch` with `cfg.http_method` (default POST) and JSON body.
  6. Insert a row into `sap_api_sync_log` with status/latency/message (mirrors `testSapConnection`).
  7. Return `{ ok: boolean, status: number, error?: string }`. Do not return response body to client (avoids leaking SAP internals).

No SAP password ever travels to the browser — only the form-entered credentials go to the server function, the SAP Basic Auth uses the globally stored creds.

## Frontend — `src/routes/login.tsx`

- Import `useServerFn` and the new `sapLogin`.
- In `submit()`, for `mode === "signin"`:
  - Remove the `supabase.auth.signInWithPassword(...)` call.
  - Call `sapLoginFn({ data: { username: email, password } })`.
  - On `ok` → `toast.success("Welcome")` and `nav({ to: "/inbox" })`.
  - On `!ok` → `toast.error(result.error ?? \`Login failed (\${result.status})\`)`.
- `mode === "signup"` path is unchanged.

## Caveat to flag in the response after build

The `/inbox` route lives under `_authenticated`, whose gate checks for a Supabase session. Since this flow no longer creates one, the user will be redirected back to `/auth`/`/login` on the next navigation. If you want the SAP-success path to actually land the user inside the app, we'll need a follow-up (e.g. mint a Supabase session server-side after SAP success, or relax the gate). I'll call this out after implementing so you can decide.

## Files

- New: `src/lib/auth/sap-login.functions.ts`
- Edited: `src/routes/login.tsx`
