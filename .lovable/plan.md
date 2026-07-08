## Problem

In `src/lib/auth/sap-login.functions.ts`, the SAP login is treated as successful whenever the HTTP call returns 2xx and the response body doesn't contain an obvious rejection keyword:

```ts
ok = (res.ok && !sapLoginRejected(body)) || sapLoginSucceeded(body);
```

Many SAP wrappers return HTTP 200 with a payload like `{ "STATUS": "E", "MESSAGE": "Invalid credentials" }`. If the keyword heuristic in `sapLoginRejected` doesn't catch that exact phrasing, the app logs the user in with a wrong password — which is what's happening.

The demo user IDs (`admin@demo.app`, `hod@demo.app`, `finance@demo.app`, `requester@demo.app`) are separate — they go through Supabase `signInWithPassword`, not SAP — so tightening SAP login won't affect the "click a demo user" flow.

## Fix

In `src/lib/auth/sap-login.functions.ts`, change the success rule for both the middleware branch and the direct branch to require an **explicit** SAP success signal, not just "HTTP 2xx and no rejection keyword":

```ts
ok = sapLoginSucceeded(body) && !sapLoginRejected(body);
```

Additionally, harden `sapLoginSucceeded` so it only returns true on explicit positive markers:

- `ok === true` / `success === true` on any nested object, OR
- a `status`/`code`/`type`/`result` field whose value is one of `"s"`, `"success"`, `"successful"`, `"ok"`, `"true"`, `"200"` (drop the bare `"1"` match — too permissive for SAP payloads that use `1` as a row index), OR
- a message field that explicitly matches `/\b(login\s*success|authenticated|welcome)\b/i` (drop the standalone `valid` / `success` matches that fire on unrelated text).

When `ok` is false and no `error` was set from status-based branches, fall back to `loginErrorFromBody(body, "Invalid SAP credentials")` so the toast on the login page shows a real message instead of a generic 200.

No other files change. The demo-account buttons keep working because they hit Supabase auth, not this server function.

## Verification

- `tsgo` typecheck.
- Manual check via the preview: entering a wrong password against SAP should now show the error toast and stay on `/login`; clicking a demo account still signs in.
