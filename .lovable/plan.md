# Restore SAP login on the Quality server

## Confirmed request path

```text
Browser :8081
  -> Nginx /_serverFn/*
  -> app runtime 127.0.0.1:8080
  -> middleware 127.0.0.1:3002 /login/Login_API
  -> SAP 10.150.150.155:8005
```

The Nginx routing shown is correct for this flow. The HTML `502 Bad Gateway` shown in the login popup occurs before SAP processing: Nginx could not get a valid response from the app runtime at `127.0.0.1:8080`. The middleware PM2 output confirms it is listening on `3002`, but it does not confirm that the app runtime is running.

Separately, `curl` and `nc` from the Quality server to the SAP host/port hang. That confirms the Quality server currently has no usable TCP path to `10.150.150.155:8005`. Even after port 8080 is restored, SAP login will time out until that network path is allowed.

## 1. Restore the app runtime on port 8080

Run on the Quality server:

```bash
ss -ltnp | grep ':8080' || true
curl -sv --connect-timeout 5 http://127.0.0.1:8080/ -o /dev/null
pm2 status
tail -n 100 /data/webapplication/resl_approval/Quality/logs/error.log
```

If nothing listens on 8080, start the built server from the frontend directory, not from the middleware directory:

```bash
cd /data/webapplication/resl_approval/Quality/frontend
test -f dist/server/index.mjs
test -f package.json
test -f scripts/start-server.mjs
npm ci --include=dev
PORT=8080 HOST=127.0.0.1 npm start
```

Once that foreground test answers on 8080, run it under PM2 with the same backend environment required by the app, then save the process list:

```bash
cd /data/webapplication/resl_approval/Quality/frontend
PORT=8080 HOST=127.0.0.1 pm2 start npm --name resl-app-quality -- start
pm2 save
curl -i --connect-timeout 5 http://127.0.0.1:8080/login
curl -i --connect-timeout 5 http://10.150.150.130:8081/login
```

The app runtime must have its server-side backend variables and `MIDDLEWARE_SHARED_SECRET`; the browser build variables alone are not sufficient.

## 2. Verify the middleware independently

The active PM2 output says the middleware listens on `3002`, matching the Nginx upstream. Confirm the live process and its current environment:

```bash
curl -sS http://127.0.0.1:3002/__health
pm2 describe 1
pm2 env 1 | grep -E '^(PORT|APP_BASE_URL|MIDDLEWARE_MOCK)='
```

Expected health output: `ok: true`, port `3002`, live mode, and app base URL `http://10.150.150.130:8081`.

Test middleware-to-app configuration lookup using the shared secret from the server environment (do not paste it into chat):

```bash
curl -sS -i -X POST http://127.0.0.1:8080/api/public/middleware/config \
  -H 'Content-Type: application/json' \
  -H 'x-shared-secret: <SAME_SHARED_SECRET>' \
  -d '{"name":"Login_API"}'
```

Expected: HTTP 200 with an active `Login_API`, the SAP endpoint, and non-empty global Basic-auth credentials. A 401 means the app and middleware secrets differ; 404 means the API row is missing; 422 means the saved SAP URL/base URL is invalid.

## 3. Confirm that browser login reaches the middleware

Keep these running in separate terminals, then click **Sign in** once:

```bash
pm2 logs resl-app-quality --lines 100
pm2 logs 1 --lines 100
tail -f /data/webapplication/resl_approval/Quality/logs/error.log
```

Interpretation:

- Nginx 502 and no app log: app runtime on 8080 is unavailable or crashed.
- App log appears but no middleware `[request] POST /login/Login_API`: the saved middleware URL is wrong. Set it to `http://127.0.0.1:3002`.
- Middleware receives the request and returns 401: shared-secret mismatch.
- Middleware logs the request and then times out calling SAP: the application path is correct; only SAP network access remains blocked.

## 4. Test the exact middleware login route

After the config lookup succeeds:

```bash
curl -sS -i -X POST http://127.0.0.1:3002/login/Login_API \
  -H 'Content-Type: application/json' \
  -H 'x-shared-secret: <SAME_SHARED_SECRET>' \
  -d '{"inputs":{"LOGIN":{"USER":"<SAP_USER_ID>","PASSWORD":"<SAP_LOGIN_PASSWORD>"}}}' \
  --connect-timeout 10 --max-time 150
```

This is the same route and payload shape used by the app. It should produce a request entry in the middleware PM2 log immediately, even if SAP later times out.

## 5. Request the required network/firewall change

Ask the network/SAP team to permit outbound TCP from the Quality application server `10.150.150.130` to SAP `10.150.150.155` on port `8005`. If SAP restricts source IPs, the Quality server must be allow-listed. Then verify:

```bash
nc -vz -w 10 10.150.150.155 8005
curl -sv --connect-timeout 10 --max-time 60 \
  http://10.150.150.155:8005/ -o /dev/null
```

Only after TCP connectivity succeeds should the full direct SAP POST and middleware login POST be retried. A timeout is a routing/firewall issue; changing application code, Nginx proxy timeouts, or SAP credentials will not fix it.

## 6. Final end-to-end verification

1. `127.0.0.1:8080/login` responds without 502.
2. `127.0.0.1:3002/__health` returns `ok: true`.
3. Middleware config lookup returns HTTP 200.
4. `nc` to the SAP host/port succeeds.
5. Middleware login returns the SAP `USER`/`PLANTS` JSON.
6. Browser login creates the app session and opens the inbox.

Because SAP and login credentials were included in shared screenshots/messages, rotate those exposed credentials after connectivity is restored.