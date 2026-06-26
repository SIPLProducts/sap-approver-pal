# Create User via SAP Middleware API

Replace the existing Supabase-only `createUser` flow with a SAP-only call that goes through the configured Node.js middleware (`/sap/invoke`). On success, show the SAP `MESSAGE` and refresh the User Management table.

## 1. Register the SAP "Create User" API in SAP API Settings

The middleware looks up the request by `configId` from `sap_api_configs`. We will not hardcode the endpoint URL in code — the admin already manages SAP endpoints in **Admin → SAP API Settings**.

- Convention: a config named exactly **`USER_CREATE`** (module = `COMMON`, `http_method = POST`, `auth_type = basic` or `proxy`) holds the SAP endpoint URL (e.g. `…/sd_approval_mng/user/create?sap-client=300`) and credentials.
- The new server function resolves this config by name at call time. If the row is missing it returns a clear error: *"SAP Create User API is not configured. Add a config named USER_CREATE in SAP API Settings."*

(The URL pasted in chat — `…/login/login?sap-client=300` — is a login endpoint, not Create User. The admin can save the correct Create User URL once in SAP API Settings without any further code change.)

## 2. New server function: `createUserViaSap`

File: `src/lib/admin/user-mgmt.functions.ts`

- `createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])`
- Input (Zod): same shape the dialog already collects — `sap_user_id`, `first_name`, `last_name`, `email`, `contact_number`, `password`, `confirm_password`, `status` (`Active`/`Inactive`), `plants: string[]`, `roles: AppRole[]`.
- Authorize: `assertAdmin(context.userId)` (existing helper).
- Resolve `configId`: `supabaseAdmin.from('sap_api_configs').select('id').eq('name','USER_CREATE').maybeSingle()`.
- Build payload exactly per the spec:

```text
{
  "CREATE": {
    "USER": <sap_user_id upper>,
    "FIRST_NAME": <first_name upper>,
    "LAST_NAME":  <last_name upper>,
    "EMAIL": <email>,
    "CONTACT": <contact_number>,
    "PASSWORD": <password>,
    "ZCONFPSWD": <confirm_password>,
    "STATUS": status === 'Active' ? 'ACTIVE' : 'INACTIVE',
    "PLANTS": plants.map(p => ({ WERKS: p })),
    "ROLES":  plants.flatMap(p => roles.map(r => ({ WERKS: p, ROLE: String(r).toUpperCase() })))
  }
}
```

Roles mapping: per user's answer, apply every selected role to every selected plant (cartesian product). App role keys are sent as-is, uppercased.

- Call `invokeViaMiddleware(configId, payload)`.
- Treat success when the response body has `STATUS === "TRUE"` (or middleware `ok && data.STATUS === 'TRUE'`). Return `{ ok: true, message: data.MESSAGE, number: data.NUMBER }`.
- Failure: throw `new Error(data?.MESSAGE || result.error || 'SAP rejected the request')` so the dialog can surface it.
- Audit log: insert `admin_audit_log` row with `action: 'user.sap_create'`, payload includes the sanitized request (no password) and SAP response.

## 3. Dialog wiring

File: `src/routes/_authenticated/admin.users.tsx` (`CreateUserDialog`)

- Replace `useServerFn(createUser)` with `useServerFn(createUserViaSap)`.
- Keep all existing client-side validation (plant ≥ 1, role ≥ 1, password ≥ 8, 10-digit contact, matching passwords).
- Submit handler: pass form values + `plants` + `roles` straight through; no Supabase auth/profile writes happen anymore.
- On success: `toast.success(result.message ?? 'User created successfully')`, `reset()`, `onCreated()` (already invalidates `admin-profiles`, `admin-user-roles`, `admin-user-tenants` — table refreshes).
- On error: `toast.error(e.message)` (existing behavior).

## 4. Keep / remove existing code

- `createUser` (Supabase-backed) is no longer used by the dialog. Leave the export in place for now but unused, or delete it — recommend **delete** plus the `inviteUser` alias to avoid future confusion. The `deleteUser` / `setBuiltInRole` server functions stay untouched.
- No DB migration is needed; the new function only reads `sap_api_configs` and writes to `admin_audit_log`.

## Technical notes

- The Users table data source (`profiles`, `user_roles`, `user_tenants`) is unchanged. After Replace, the table will only reflect users that SAP returns from its own list endpoint — surfacing those is **not** in scope here (separate request).
- `invokeViaMiddleware` already handles the proxy-secret 401 case; SAP-side auth/validation errors arrive with `STATUS = "FALSE"` (or HTTP non-200 wrapped as 502) and surface via `data.MESSAGE`.
- No client/browser code reads SAP credentials — everything runs in the server function.
