## Goal

Stop hardcoding full SAP URLs (e.g. `http://10.150.150.154:8103/sd_approval_mng/...`) on each API config. Move the host (Base URL) and a shared SAP username/password to a new **SAP Connection** tab in `Admin → SAP API Settings`, so switching from DEV to Quality is a single config change.

## Where it's hardcoded today

- `sap_api_configs.endpoint_url` stores the **full URL** (host + path + query). Set per-API in `admin.sap-api.index.tsx` / `admin.sap-api.$id.tsx`.
- Middleware (`middleware/server.js`) and server functions (`src/lib/sap/sap-client.server.ts`, all `src/lib/sd/*.functions.ts`) read `endpoint_url` as-is.
- `sap_global_settings` already exists but only stores middleware connection info — no SAP base URL / credentials.

## Changes

### 1. DB migration — extend `sap_global_settings` + `sap_global_secrets`

Add columns:
- `sap_global_settings.sap_base_url text` (e.g. `http://10.150.150.155:8005`)
- `sap_global_settings.sap_environment text` (free label: `DEV` / `QUALITY` / `PROD`)
- `sap_global_settings.sap_username text`
- `sap_global_secrets.sap_password text`

No data deletion. Existing rows keep working.

### 2. Endpoint URL resolution becomes path-aware

A config's `endpoint_url` may now be:
- a relative path like `/sd_approval_mng/zvk11_app/vk11_app?sap-client=300`, **or**
- a full `http(s)://...` URL (legacy, still honored).

Resolution helper (new, in `src/lib/sap/url.ts` and mirrored in `middleware/server.js`):
```
resolveSapUrl(endpoint_url, baseUrl) =>
  endpoint_url starts with http → return as-is
  else → join(baseUrl, endpoint_url)
```

Wire it in:
- `src/lib/sap/sap-client.server.ts` (direct mode invoker)
- `middleware/server.js` (`loadConfig` resolves to absolute URL after fetching cfg + global base)
- `src/routes/api/public/middleware/config.ts` (return resolved URL + sap creds so the middleware sees one absolute URL)

### 3. Credential fallback

Per-API `sap_api_credentials` row, if present, still wins. Otherwise fall back to the new global `sap_username` / `sap_password`. Same precedence in middleware (`loadConfig` already has a fallback hook).

### 4. Admin UI — new "SAP Connection" tab

In `src/routes/_authenticated/admin.sap-api.index.tsx`, after the existing **APIs** and **Middleware Configuration** tabs, add a third tab **SAP Connection** with:
- Environment label (text)
- SAP Base URL (text, validated as `http(s)://host[:port]`)
- SAP Username (text)
- SAP Password (password input, masked, "set" badge when already saved)
- Save button + Test button (HEAD against `${base}/` with basic auth, surfaces status code)

Backed by new `src/lib/admin/sap-global.functions.ts` fields (`sap_base_url`, `sap_username`, `sap_password`). Reuses existing admin-only RLS.

### 5. Per-API endpoint UI hint

In `admin.sap-api.$id.tsx` and the "new endpoint" dialog, change the Endpoint URL label to **Endpoint Path or URL** and add helper text:  *"Use a relative path like `/sd_approval_mng/...` to inherit the SAP Base URL from SAP Connection settings."* No data migration — operators can shorten URLs at their own pace.

### 6. No business-logic changes elsewhere

SD approval flows (`sales-order`, `contract`, `price`, `sc-so`) just keep calling the same server fns; URL resolution happens inside the SAP client / middleware layer.

## Out of scope

- Per-tenant base URLs (single global env for now).
- Auto-migrating existing full URLs into base+path.
- OAuth credentials in the global tab (basic only — matches current usage).

## Files touched

- `supabase/migrations/<new>.sql` — add columns
- `src/lib/sap/url.ts` *(new)* — `resolveSapUrl` helper
- `src/lib/sap/sap-client.server.ts` — use helper + global base + cred fallback
- `src/routes/api/public/middleware/config.ts` — return resolved URL + global creds
- `middleware/server.js` — accept resolved URL from app; keep env fallback for self-hosted mock
- `src/lib/admin/sap-global.functions.ts` — read/write new fields, store password in `sap_global_secrets`
- `src/routes/_authenticated/admin.sap-api.index.tsx` — add **SAP Connection** tab
- `src/routes/_authenticated/admin.sap-api.$id.tsx` — relabel Endpoint URL, helper text
