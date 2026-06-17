## What's happening

Two separate problems are visible in the log you pasted:

### 1. SAP returns an HTML page (not JSON) for `Get_Plant`
The middleware successfully calls `http://10.150.150.155:8005/sd_approval_mng/f4_help/help?sap-client=300`, but SAP responds with a full HTML page (the trailing `…2026 SAP SE, All rights reserved…</body></html>` in the log). That's SAP's standard **login / error page**, which it returns when the request is **unauthenticated** (no `Authorization: Basic …` header) or the user is locked. The app then shows "No plants returned by Get_Plant".

Why no auth header is being sent: in the `Get_Plant` API row, `auth_type` is almost certainly `none` (or credentials aren't attached to that row). The middleware only sends Basic auth when `cfg.auth_type === "basic"`. The `SAP_BP_USERNAME/PASSWORD` fallbacks from `.env` are copied into `cfg.credentials` but `auth_type` is left as-is, so the header is never built.

### 2. `writeLog` fails with `String must contain at most 2000 character(s)`
The `/api/public/middleware/log` route validates `message` ≤ 2000 chars. The middleware truncates to 4000 (`fullBody.slice(0, 4000)`), so when SAP returns a long HTML page the log call rejects. This is why you see `[log] failed […too_big…]`.

## Fix

### `middleware/server.js`
1. **Auto-upgrade auth_type to `basic`** in `loadConfig` whenever credentials end up populated (from row or fallback) but `auth_type` is `none`/empty. This makes the Basic header get sent for `Get_Plant` and any other row without explicit auth.
2. **Truncate every `writeLog` message to 1900 chars** (safety margin under the 2000 limit) in:
   - `/sap/invoke`
   - `namedInvokeRoute` (4000 → 1900)
   - `namedRawInvokeRoute` (already short, but apply the same clamp for safety)
   - error paths (already `.slice(0, 500)`, leave as-is)
3. **Detect HTML responses from SAP** in `invokeSap`: when `content-type` is `text/html` or the body starts with `<`, return a structured error `{ __sap_html_error: true, __raw_preview: text.slice(0,500) }` and mark `ok=false`. This makes the UI surface "SAP returned an HTML login page — check credentials" instead of silently rendering 0 rows.

### No app-side changes required
The Zod schema on `/api/public/middleware/log` stays at 2000; the middleware is the side that must respect it.

## Acceptance check
- Plant dropdown on Contract Approvals loads plant codes after Save SAP connection (with valid `22015661 / May@2026`).
- Middleware log shows `Authorization: ***redacted***` going out for `/sap/invoke` of `Get_Plant`.
- No more `[log] failed […too_big…]` regardless of how big SAP's response is.
- If SAP still returns HTML, the UI shows a clear "SAP returned non-JSON (HTML login page)" message instead of "0 records".
