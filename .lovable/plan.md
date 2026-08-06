# Next steps after the backend is running on the Quality server

The Supabase backend stack is now up (`supabase-kong` is healthy). To make the app usable, the frontend must be built, shipped, and served behind Nginx.

## Step 1 — Build the frontend

Run this on a machine with Node 20+ and the repo checked out:

```bash
cd /data/webapplication/resl_approval/Quality/frontend
npm ci
npm run build
```

Expected output: a single `dist/` folder at `frontend/dist/`. No other build folders should remain.

## Step 2 — Copy the build to the server

```bash
rsync -a dist/ root@10.150.150.130:/data/webapplication/resl_approval/Quality/frontend/dist/
```

## Step 3 — Start the app server

On the server:

```bash
cd /data/webapplication/resl_approval/Quality/frontend
PORT=8080 HOST=127.0.0.1 npm start
```

Recommended: use pm2 or systemd so it keeps running after logout.

## Step 4 — Configure and reload Nginx

Use the Nginx config from `DEPLOY-QUALITY.md`. It listens on port 8081 and proxies:

- `/_serverFn/` and `/api/` to the app server on port 8080
- `/mw/` to the SAP middleware on port 3002
- `/supabase/` to Kong on port 8000
- `/studio/` to Supabase Studio on port 3000
- all other routes to the static frontend shell

Then reload:

```bash
nginx -t && systemctl reload nginx
```

## Step 5 — Verify the app is reachable

Open http://10.150.150.130:8081/ in a browser. The login page should load.

## Supabase and login

Yes, Supabase is required for login and for the app to work. The app uses SAP-based authentication: the SAP login API validates the user, then the app creates/uses a Supabase auth user for the session. Supabase is also the backend database for user profiles, roles, approval data, and API settings.

## Notes

- The SAP middleware container (`sap-middleware-quality`) must also be running on port 3005 if you are using the proxy path `/mw/`.
- In **SAP API Settings**, keep "Via Proxy" enabled and set the middleware URL to `http://10.150.150.130:3002` or `http://10.150.150.130:8081/mw`.
- If you want to create an admin user before anyone else logs in, sign in with the first user and the trigger will automatically grant them the `Admin` role.
