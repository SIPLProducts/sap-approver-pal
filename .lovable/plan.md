## Diagnosis

The app's SAP calls go: browser → server function `runSapApi` → `invokeViaMiddleware` → `POST {middleware_url}/sap/invoke` → your Node middleware → SAP.

Your configured `middleware_url` is:

```
https://worsening-doodle-floral.ngrok-free.dev
```

The 502 Bad Gateway is returned by **ngrok**, not by the app and not by SAP. 502 from ngrok means the tunnel is up but the upstream — your local Node middleware (`middleware/server.js`, default port 3005) — is not reachable. That is why Postman works for you locally (you hit `localhost:3005` directly) but the app fails (the cloud worker can only reach SAP through the ngrok tunnel, which has no one listening behind it).

Common causes, in order of likelihood:

1. The middleware Node process is not running on the machine ngrok is forwarding to.
2. The middleware is running on a different port than ngrok is forwarding to (default expected: `3005`).
3. ngrok was restarted and got a new URL, but `middleware_url` in SAP API Settings still points to the old one.
4. The free ngrok tunnel hit a limit / was killed.

## Fix steps (no code change needed first)

1. On the middleware host machine, confirm the service is up:
   - `curl http://localhost:3005/__health` — should return `{"ok":true,"service":"sap-middleware",...}`.
   - If it errors, start it: `cd middleware && npm start` (or restart the Windows service if installed via `install-windows-service.ps1`).
2. Confirm ngrok is forwarding to the right port:
   - `ngrok http 3005` and check the public URL it prints.
   - From any machine: `curl https://worsening-doodle-floral.ngrok-free.dev/__health` — must return the same health JSON. If it returns 502, ngrok cannot reach `localhost:3005`.
3. If ngrok printed a new URL, update **SAP API Settings → Middleware Configuration → Middleware URL** to that new URL and save.
4. Retry the failing screen in the app.

## If it still fails after the above

Capture and share:
- Output of `curl -i https://worsening-doodle-floral.ngrok-free.dev/__health`
- Middleware console log lines around the failing request (the middleware logs every incoming request with method/path/body)
- The full app-side error toast / Network response body for the failing call

With those three I can pinpoint whether it's a shared-secret mismatch, an APP_BASE_URL misconfig on the middleware, or a SAP-side auth/HTML-page response.

## Out of scope

No code change is proposed yet — the 502 is an infra/connectivity issue, not an app bug. If after step 4 we discover a real code-side cause (e.g. the worker needs different error surfacing, or `invokeViaMiddleware` should retry/timeout differently), I will plan that as a follow-up.
