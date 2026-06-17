## Problem

`Get_Plant` (GET) works but `Price_Approval_Fetch` (POST) returns SAP 401 with an HTML login page. Both endpoints use the same SAP server and the global SAP Connection credentials (SARVI_INFO1) — so the credentials themselves are valid. The difference is per-config credential overrides.

## Root cause

In `src/routes/api/public/middleware/config.ts` (lines 140–141) the resolver merges per-config credentials with the global SAP Connection like this:

```ts
username: creds?.username ?? globalRes.data?.sap_username ?? null,
password: creds?.password_encrypted ?? globalSecretRes.data?.sap_password ?? null,
```

`??` only falls back on `null` / `undefined`. The Credentials tab (`admin.sap-api.$id.tsx` line 101) always sends `username: creds.username` — an **empty string** when the user never typed a username on that tab. The first time anyone opened the Credentials tab on `Price_Approval_Fetch` and clicked Save, a `sap_api_credentials` row was written with `username = ""` (and possibly `password_encrypted = ""`). From then on `creds?.username ?? global` returns `""`, the middleware sends `Authorization: Basic OnBhc3N3b3Jk` (empty user), and SAP responds with its HTML login page → 401.

That's exactly why `Get_Plant` still works (no per-config creds row, falls through to global) while `Price_Approval_Fetch` doesn't.

The same `??`-vs-empty-string bug exists in `middleware/server.js` `loadConfig()` when applying the `FALLBACK_BP_*` env defaults.

## Fix

Treat empty strings (and whitespace-only strings) as "not set" everywhere per-config credentials are merged with the global SAP Connection.

### 1. `src/routes/api/public/middleware/config.ts`

Replace the credentials block with a helper that returns the first non-empty value:

```ts
const pick = (...vals: (string | null | undefined)[]) =>
  vals.find((v) => typeof v === "string" && v.trim() !== "") ?? null;

credentials: {
  username: pick(creds?.username, globalRes.data?.sap_username),
  password: pick(creds?.password_encrypted, globalSecretRes.data?.sap_password),
  extra_headers: creds?.extra_headers ?? {},
},
```

### 2. `middleware/server.js` — `loadConfig`

Apply the same non-empty fallback when filling in `FALLBACK_BP_*`:

```js
const isBlank = (v) => v == null || (typeof v === "string" && v.trim() === "");
if (isBlank(cfg.credentials.username)) cfg.credentials.username = FALLBACK_BP_USERNAME || null;
if (isBlank(cfg.credentials.password)) cfg.credentials.password = FALLBACK_BP_PASSWORD || null;
```

And tighten the existing auto-upgrade-to-basic check to use `isBlank` instead of truthiness so an empty-string `auth_type` is treated the same as `none`.

### 3. (Optional polish) Credentials Save UX

In `src/routes/_authenticated/admin.sap-api.$id.tsx` (line 101), only send `username` when the field is non-empty, so saving a blank tab does not overwrite the global default:

```ts
await saveCredsFn({
  data: {
    config_id: id,
    username: creds.username.trim() || undefined,
    password: creds.password || undefined,
    extra_headers: headers,
  },
});
```

This prevents the same trap from being re-created for any future API config.

## Verification

1. Open `Price_Approval_Fetch` → Credentials tab → leave username blank → Save (or have the user run it as-is; the resolver change alone fixes existing rows).
2. Click **Execute** on Price Approvals with Plant `3801`.
3. Middleware log should now show `Authorization: Basic <SARVI_INFO1:...>` being sent and SAP returning JSON (not the `__sap_html_error` payload).
4. `Get_Plant` continues to work unchanged.

No database migration required — the fix is purely in the resolver and middleware fallback logic.
