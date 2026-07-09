## Goal
Wire up the "Forgot?" link on the login page to reveal an email input + Send button, and on Send call the SAP API config named `Forgot_API` (defined in Admin → SAP API Settings) with the user's email as payload.

## Changes

### 1. New server function — `src/lib/auth/sap-forgot.functions.ts`
Public `createServerFn({ method: "POST" })` named `sapForgot`:
- Input (zod): `{ email: string().email().max(200) }`.
- Load `sap_api_configs` where `name = 'Forgot_API'` and `is_active = true` (service-role client, same pattern as `sapLogin`).
- If missing → return `{ ok: false, status: 0, error: "Forgot_API is not configured in SAP API Settings" }`.
- Build payload `{ FORGOT: { EMAIL: email } }` (mirrors the `LOGIN` shape used by `Login_API`).
- Two call paths, identical to `sapLogin`:
  - If `sap_global_settings.middleware_url` is set → POST to `${middleware_url}/login/Forgot_API` with `x-shared-secret` header and body `{ inputs: payload }`.
  - Else → direct call using `cfg.endpoint_url` (resolved via `resolveSapUrl` + `sap_base_url`), `cfg.http_method`, Basic auth from global creds when `auth_type='basic'`, plus `extra_headers` from `sap_api_credentials`.
- Reuse the existing `sapLoginSucceeded` / `sapLoginRejected` / `loginErrorFromBody` / `parseResponseBody` helpers by exporting them from `sap-login.functions.ts` (or duplicating minimal versions) to keep the success/error interpretation consistent.
- Log the attempt into `sap_api_sync_log` with `message: 'forgot <path>: <status>'`.
- Return `{ ok, status, error? }`.

No auth middleware (login-page action, same as `sapLogin`).

### 2. Login page — `src/routes/login.tsx`
- Add state: `forgotOpen: boolean`, `forgotEmail: string`, `forgotBusy: boolean`.
- Replace the "Forgot?" button's no-op with `onClick={() => setForgotOpen(v => !v)}`.
- When `forgotOpen && mode === "signin"`, render below the password field (or under the submit button) a small inline panel:
  - Label "Reset password"
  - `<Input type="email">` bound to `forgotEmail`
  - `<Button>` "Send" that calls the new `sapForgot` server fn via `useServerFn`.
  - On success → `toast.success("Password reset request sent")`, close the panel, clear the field.
  - On failure → `toast.error(result.error ?? "Could not send reset request")`.
- Keep it inside the existing form column; styling matches the current demo-account panel (rounded border, `bg-secondary/40`).

### Out of scope
- No changes to the SAP API Settings admin UI (the Forgot_API config is assumed to be created there manually, same as Login_API).
- No Supabase password reset email — this flow delegates to SAP.
- No visual redesign of the login page.

## Technical notes
- The `Forgot_API` payload shape follows the same `{ VERB: { … } }` convention as `Login_API`. If SAP expects a different field name (e.g. `USER` instead of `EMAIL`), that only requires changing the `payload` builder — the transport/middleware code is unchanged.
- The Send button is disabled while `forgotBusy` is true and requires a non-empty valid email (HTML5 `type="email"` + `required`).
