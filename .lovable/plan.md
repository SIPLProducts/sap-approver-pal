# Which SAP the Lovable preview login uses, and why it failed

## What is configured right now (read from your backend settings)

| Hop | Value |
|---|---|
| Middleware the app calls | `https://sector-protozoan-humorist.ngrok-free.dev` (ngrok tunnel to your local/on-prem middleware) |
| SAP base URL the middleware calls | `http://10.150.150.154:8103` |
| SAP technical user | `SARVIINFO` |
| Shared secret | present (6 characters) |
| Login endpoint used | `POST <middleware>/login/Login_API` with `{"inputs":{"LOGIN":{"USER":...,"PASSWORD":...}}}` |

So the Lovable preview does **not** talk to SAP directly, and Supabase never validates the password. The chain is:

```text
Preview browser → Lovable server function (sapLogin)
  → ngrok middleware → SAP 10.150.150.154:8103 (Login_API)
  → back to server function → backend session created
```

## Why your login attempts failed

The three attempts at 07:08, 07:11 and 07:12 UTC all returned `status 500, error "fetch failed"` and each took about 14–15 seconds. The login log stores them as `login middleware: 500`. A 14-second `fetch failed` is a connection timeout from the Lovable server to the ngrok URL — the request never reached SAP, so it is not a credential problem.

Checked again just now:

- `GET <middleware>/__health` → `200 {"ok":true,"service":"sap-middleware","mode":"live"}`
- `POST <middleware>/login/Login_API` without the secret → `401 Invalid or missing x-shared-secret`

The tunnel is reachable again, and the login route exists and enforces the shared secret. The most recent successful preview logins were `login middleware: 200` on 10 Aug. The failures line up with the tunnel or middleware being restarted or offline during that window.

## Step 1 — Retry login in the preview

Sign in again with your SAP user. Because the middleware answers now, this is expected to succeed without any code change.

## Step 2 — If it fails again, identify the exact hop

Run these on the machine that hosts the middleware:

```bash
curl -i http://127.0.0.1:3002/__health
curl -i -X POST http://127.0.0.1:3002/login/Login_API \
  -H 'content-type: application/json' \
  -H 'x-shared-secret: <proxy secret from SAP settings>' \
  -d '{"inputs":{"LOGIN":{"USER":"<sap user>","PASSWORD":"<password>"}}}'
```

Interpretation:

- Local health fails → the middleware process is down; start it.
- Local health works but the public ngrok URL fails → the tunnel died and now has a **different** URL. ngrok free URLs change on restart, so the stored middleware URL must be updated in SAP Settings.
- Both work but the app still reports `fetch failed` → the tunnel is dropping the Lovable request; restart the tunnel.
- SAP returns an HTML `Anmeldung fehlgeschlagen` page → the SAP technical user/password or `sap-client` is wrong, not the app.

## Step 3 — Make the failure readable instead of `fetch failed`

Small improvement to the login server function so the cause is obvious in the UI instead of a bare `fetch failed`:

- Add an explicit request timeout (about 20 s) to the middleware `fetch`.
- On a network-level failure, return a message naming the hop, for example: `Cannot reach the SAP middleware at <host>. The middleware or its tunnel is offline.`
- Keep the existing 401 / 404 / 403 messages unchanged.

Files touched: `src/lib/auth/sap-login.functions.ts` only. No change to the middleware, the deployed server, or SAP settings.

## Note on the Quality server

This is separate from the on-prem Quality deployment. There, the app server uses the middleware at `http://127.0.0.1:3002`, not this ngrok URL. The ngrok URL only exists so the hosted Lovable preview can reach your internal SAP network.
