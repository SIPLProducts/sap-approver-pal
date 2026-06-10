## Goal
Add a new **Middleware Configuration** tab on the SAP API Settings list screen with global Node.js middleware settings shared by all SAP API integrations.

## Fields (global, single row)
- **Connection Mode** — `direct` | `via_proxy`
- **Deployment Mode** — `lovable_cloud` | `self_hosted`
- **Middleware Port** — number (default 3002)
- **Node.js Middleware URL** * — required when Connection Mode = via_proxy
- **Proxy Secret / Password** * — required when Connection Mode = via_proxy

## Plan

### 1. Database (migration)
- `public.sap_global_settings` (singleton): `id text pk default 'default'`, `connection_mode text`, `deployment_mode text`, `middleware_port int`, `middleware_url text`, `updated_at`, `updated_by`. RLS on. Admin-only read/write via `has_role(auth.uid(),'Admin')`. GRANT to authenticated + service_role.
- `public.sap_global_secrets`: `id text pk`, `proxy_secret text`. RLS on, no policies (service-role only). GRANT all to service_role only.
- Seed `('default','direct','lovable_cloud',3002,null)`.

### 2. Server functions — `src/lib/admin/sap-global.functions.ts`
- `getSapGlobalSettings` — Admin only; returns the singleton row + `proxy_secret_set: boolean` (secret value never sent to client).
- `upsertSapGlobalSettings` — Admin only; validates `via_proxy` ⇒ middleware_url required & secret present; writes secret via `supabaseAdmin` only when caller passes a non-empty value (blank keeps existing).
- Server helper `getGlobalMiddleware()` used by `testSapConnection`, `src/lib/sap/sap-client.server.ts`, and `src/lib/sd/price-approval.functions.ts` so any API with `auth_type='proxy'` resolves URL + secret from the global row instead of per-config fields.

### 3. UI
- Convert `src/routes/_authenticated/admin.sap-api.index.tsx` to a `<Tabs>` layout with two tabs:
  - **APIs** — existing list/table.
  - **Middleware Configuration** — new card with the 5 fields above, Connection-Mode-aware required validation, Save button + toast, plus a "Test middleware" action that pings the configured URL and shows latency.
- Per-API edit screen (`admin.sap-api.$id.tsx`) keeps `auth_type='proxy'` as the opt-in switch; the Connectivity tab is updated to point at this new tab. Existing per-config `middleware_url` / `proxy_secret_ref` inputs are hidden (columns kept for back-compat but no longer edited).

## Out of scope
- Migrating existing per-config middleware values into the global row.
- Multiple middleware profiles or per-environment splits.
- Encryption-at-rest for the secret (mirrors existing `sap_api_credentials` pattern; follow-up).

## Technical notes
- Secret lives in a service-role-only table (`sap_global_secrets`) so it never reaches the browser; UI shows a "set" badge and a blank input.
- `getGlobalMiddleware()` is the single source of truth for both Test Connection and runtime SAP calls.
