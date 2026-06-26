## What the 401 actually means

`middleware/server.js` returns **401 Unauthorized** in exactly one place — the `requireSharedSecret` guard (line 61–67):

```js
if (!got || got !== SHARED_SECRET) {
  return res.status(401).json({ ok: false, error: "Invalid or missing x-shared-secret" });
}
```

When **SAP itself** rejects with 401 (bad username/password/sap-client), the middleware wraps it as **502 Bad Gateway** (named routes line 549–557, generic `/sap/invoke` line 502). It would also return the SAP HTML login page as a 502 with `__sap_html_error: true` in the body.

So the 401 you're seeing right now is **not** SAP auth failing — it's the **app ↔ middleware shared-secret mismatch**. The request never reaches SAP.

## Likely causes (in order)

1. **Proxy Secret in the app DB is empty or different from `MIDDLEWARE_SHARED_SECRET`** on the middleware host. `invokeViaMiddleware` only attaches the `x-shared-secret` header when `sap_global_secrets.proxy_secret` is set (sap-client.server.ts line 145). If it's blank, the middleware sees no header and returns 401.
2. **Trailing whitespace / newline** in either value (common when pasted into ngrok-running shell vs. the app form).
3. **Two different middleware instances** — the app is pointed at a middleware started with a different `MIDDLEWARE_SHARED_SECRET` env than the one you saved as Proxy Secret.

## Verification steps (no code change yet)

Run these and share results — they pinpoint which of the three it is:

1. On the middleware host, print the loaded secret length (don't print the value):
   ```
   node -e "import('dotenv/config').then(()=>console.log('len=', (process.env.MIDDLEWARE_SHARED_SECRET||process.env.SHARED_SECRET||'').length))"
   ```
2. From any shell, call the middleware directly with a known-bad and known-good secret:
   ```
   curl -i -X POST https://worsening-doodle-floral.ngrok-free.dev/sap/invoke \
     -H "content-type: application/json" -H "x-shared-secret: WRONG" \
     -d '{"configId":"00000000-0000-0000-0000-000000000000"}'
   ```
   - Expect: `401 {"ok":false,"error":"Invalid or missing x-shared-secret"}` — confirms guard works.
   Then retry with the **exact** Proxy Secret you saved in the app. If that also returns 401, the value in the app DB doesn't match the middleware env.
3. In the app, open SAP API Settings → Middleware Configuration → re-enter the Proxy Secret (don't just look at it; the field is masked). Save.

## Then — and only then — if the failure mode changes

- If you start seeing **502 Bad Gateway** with `__sap_html_error: true` in the response body → that's the real SAP-side authentication failure. The fix is the SAP Connection username/password/sap-client in the app, not the middleware.
- If you see **502 Bad Gateway** with a JSON body and `status: 401` from SAP → SAP rejected the Basic auth header. Confirm the username has API access, password isn't expired/locked, and the `sap-client` value is sent (either in `extra_headers` as `sap-client: <nnn>` or as a query param the request fields produce).

## What would change in code (only if needed after diagnosis)

- Surface the middleware's own 401 distinctly in the app UI (currently `invokeViaMiddleware` just passes `body.ok` and the raw status). A small change in `src/lib/sap/sap-client.server.ts` (~line 148–156) could detect HTTP 401 from the middleware and return `error: "Proxy Secret mismatch — middleware rejected the shared secret"` so this exact confusion doesn't recur.

No file edits are proposed yet — I need the curl/`len=` results above before touching code.
