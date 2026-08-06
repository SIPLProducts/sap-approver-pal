# Fix: 405 Not Allowed on `/_serverFn/*` + middleware pointing at the wrong app URL

## What the 405 actually is

Your nginx config has `location /supabase/`, `/studio/`, `/mw/` and a catch-all `location /`. There is **no** `location /_serverFn/` and no `location /api/`.

So a `POST /_serverFn/<hash>` falls into `location /` → `try_files $uri $uri/ /index.html` → nginx tries to serve the static file `index.html` for a POST. nginx refuses to serve a static file for POST and returns **405 Not Allowed**. That is why the error page is nginx's, not the app's.

Every SAP call in this app (login, PR/PO/ZNFA release, MIGO, user management, e-mail, push) is a server function at `/_serverFn/*`, so right now nothing beyond the static shell works.

## Step 1 — Add the two missing locations to nginx

Insert these **before** `location / { try_files ... }`:

```nginx
    # app server (server functions) — must come before location /
    location /_serverFn/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_connect_timeout 30s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_buffering off;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_read_timeout 300s;
        proxy_buffering off;
    }
```

Also add the hashed-assets block (optional but recommended):

```nginx
    location /assets/ {
        access_log off;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
```

Then:

```bash
nginx -t && systemctl reload nginx
```

## Step 2 — Make sure the app server is actually listening on 8080

nginx proxying to `127.0.0.1:8080` only works if the Node app server from `dist/server` is running:

```bash
cd /data/webapplication/resl_approval/Quality/frontend
PORT=8080 HOST=127.0.0.1 npm start
```

Keep it alive with pm2:

```bash
pm2 start npm --name Qty-App -- start
pm2 save
ss -ltnp | grep 8080     # must show the node process
```

If nothing listens on 8080 you will get **502 Bad Gateway** instead of 405 — that means step 1 worked and step 2 is missing.

## Step 3 — Fix `APP_BASE_URL` in the middleware `.env`

Right now:

```text
APP_BASE_URL=http://10.150.150.155:8005     # <- this is the SAP host, wrong
```

`APP_BASE_URL` is the URL the middleware calls **back into your app** to read SAP API configs and write the sync log. It must be your app, not SAP. On the Quality server that is:

```text
MIDDLEWARE_SHARED_SECRET=123456
APP_BASE_URL=http://10.150.150.130:8081
PORT=3002
SAP_BP_API_URL=http://10.150.150.155:8005
SAP_BP_USERNAME=...
SAP_BP_PASSWORD=...
```

The SAP host stays in `SAP_BP_API_URL` only. Restart after editing:

```bash
pm2 restart Qty-Approval --update-env
pm2 logs Qty-Approval --lines 30
```

The startup line should print `app: http://10.150.150.130:8081`.

Your pm2 log also shows two middleware instances started (`:3005` and `:3002`) under one pm2 id. Keep exactly one on 3002 (that is what nginx `/mw/` and your config point at) and delete the stray one, otherwise requests land on whichever instance won the port.

## Step 4 — SAP API Settings inside the app

Once the app loads, sign in and set in **SAP API Settings → Middleware Configuration**:

- Via Proxy: **enabled**
- Middleware URL: `http://10.150.150.130:8081/mw` (or `http://10.150.150.130:3002`)
- Proxy Secret: `123456` (must equal `MIDDLEWARE_SHARED_SECRET`)
- SAP Base URL: `http://10.150.150.155:8005`

And make sure `Login_API` exists and is active — without it login returns "Login_API is not configured in SAP API Settings".

## Your question: does login go to SAP or to the database?

**Both, in this order:**

1. The login form calls the `sapLogin` server function at `/_serverFn/*` (this is exactly the call currently returning 405).
2. That server function calls the SAP `Login_API` — via the middleware when a middleware URL is set, otherwise directly. **SAP is the sole authority on the username/password.** The database never stores or checks the SAP password.
3. If SAP says the login is valid, the server function then creates/finds a matching backend user and mints a one-time login token, so the browser gets a real session. It also caches the SAP profile (plants, roles, activities, PR/PO/NFA keys) on the user's profile row, which is what drives screen permissions.

So SAP authenticates; the database only carries the session, profile, roles and app data. Both must be reachable — SAP for the credential check, the backend stack for the session. There is no separate database password for users to set.

## Step 5 — Verify

```bash
curl -i -X POST http://10.150.150.130:8081/_serverFn/ping
```

Anything other than 405 (a JSON body, 404 from the app, even 500) means nginx is now routing to the app server instead of trying to serve a static file. Then try the login page in the browser.
