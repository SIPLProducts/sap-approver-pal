# Diagnosis: middleware cannot reach SAP (`fetch failed`)

## What the log actually says

The request reached the middleware correctly:

- `POST /login/Login_API` arrived on `127.0.0.1:3002`
- `x-shared-secret` was present and accepted (no 401)
- The config lookup succeeded — the middleware resolved the SAP target and payload
- It then tried `POST http://10.150.150.155:8005/sd_approval_mng/login/login?sap-client=300`
- Node returned `fetch failed`

`fetch failed` with no HTTP status means the TCP connection never completed: wrong host/port, SAP not listening, or a firewall/route block from the middleware host. It is **not** a credential problem, not a shared-secret problem, and nothing in the app code. SAP never answered, so there was no status and no body.

Note: earlier working notes for this environment used SAP host `10.150.150.154:8103`, while this call went to `10.150.150.155:8005`. A stale Base URL in SAP API Settings is the most likely single cause.

## Verify, in this order, on the middleware host

```bash
# 1. Is the port open at all?
curl -sS -m 10 -o /dev/null -w '%{http_code}\n' http://10.150.150.155:8005/
# timeout / connection refused = network or wrong port, stop here

# 2. Try the other known SAP host
curl -sS -m 10 -o /dev/null -w '%{http_code}\n' http://10.150.150.154:8103/

# 3. Full login call against whichever host answered
curl -sS -i -u '<SAP_USER>:<SAP_PASSWORD>' \
  -H 'Content-Type: application/json' \
  'http://<HOST>:<PORT>/sd_approval_mng/login/login?sap-client=300' \
  -d '{"LOGIN":{"USER":"22011840","PASSWORD":"12345678"}}'
```

Interpretation:
- Both hosts time out → firewall/routing from this server to SAP; needs a network fix, nothing else will help.
- `.154:8103` answers and `.155:8005` does not → the SAP Base URL stored in the app is wrong.
- SAP answers with HTML login page → Basic-auth user/password on the global SAP Connection is wrong.

## Fix path if `.154:8103` is the live host

In the app: **Admin → SAP API Settings → SAP Connection**, set

- SAP Base URL: `http://10.150.150.154:8103`

and confirm the `Login_API` row is active with endpoint `/sd_approval_mng/login/login?sap-client=300`. The middleware reads this per call, so no middleware restart or redeploy is needed — retry login immediately after saving.

## What I will change in code

Nothing yet. This is a configuration/network fault outside the app bundle.

Optional hardening I can add on approval: when the middleware's SAP fetch fails at the connection level, return an explicit message naming the host and port it tried (e.g. `Cannot reach SAP at 10.150.150.155:8005 — check SAP Base URL and network access`) instead of the bare `fetch failed`, and surface that same text in the login popup. Say the word and I will plan that edit to `middleware/server.js` and the login error mapping.
