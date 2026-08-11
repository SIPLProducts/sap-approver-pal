# Immediate recovery: populate the empty `.env` and start port 8080

The diagnosis is confirmed: `frontend/.env` is **0 bytes**. The deploy script therefore stops before starting the app server. `Qty_App` showing 0 seconds uptime with **1,989 restarts** is a crash loop, not a working process. Nothing listens on 8080, so nginx returns 502 for login requests.

Do **not** run `pm2 restart all` again. It only restarts the same broken process and unnecessarily restarts `Qty_Approval`.

## 1. Populate the empty file

Run this on the server. It prompts for sensitive values so they do not appear in shell history. Paste the anon key, service-role key, and middleware secret you already have.

```bash
cd /data/webapplication/resl_approval/Quality/frontend || exit 1

read -r -s -p "Paste ANON_KEY, then Enter: " ANON_KEY; echo
read -r -s -p "Paste SERVICE_ROLE_KEY, then Enter: " SERVICE_KEY; echo
read -r -s -p "Paste middleware shared secret, then Enter: " MW_SECRET; echo

printf '%s\n' \
  'SUPABASE_URL=http://127.0.0.1:8000' \
  "SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}" \
  "SUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY}" \
  'MIDDLEWARE_URL=http://127.0.0.1:3002' \
  "MIDDLEWARE_SHARED_SECRET=${MW_SECRET}" \
  'PORT=8080' \
  'HOST=127.0.0.1' \
  'NODE_ENV=production' > .env

unset ANON_KEY SERVICE_KEY MW_SECRET
chmod 600 .env

wc -c .env
grep -E '^(SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY|SUPABASE_SERVICE_ROLE_KEY|MIDDLEWARE_URL|MIDDLEWARE_SHARED_SECRET|PORT|HOST|NODE_ENV)=' .env \
  | sed 's/=.*$/=<set>/'
```

Expected: `wc -c .env` is greater than 0 and all eight names print as `<set>`.

## 2. Remove the crash loop and deploy cleanly

```bash
cd /data/webapplication/resl_approval/Quality/frontend/dist || exit 1
pm2 delete Qty_App 2>/dev/null || true
bash deploy-frontend.sh
```

The script should now pass step 3, start a fresh `Qty_App`, and complete all seven steps.

## 3. Verify before testing login

```bash
pm2 status Qty_App
pm2 logs Qty_App --lines 40 --nostream
ss -lntp | grep ':8080'
curl -I http://127.0.0.1:8080/
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  http://127.0.0.1:8080/api/public/middleware/config
curl -s http://127.0.0.1:3002/__health
curl -I http://10.150.150.130:8081/
```

Expected:

- `Qty_App` stays online and its restart count does not increase.
- Node listens on `127.0.0.1:8080`.
- The direct app request produces an HTTP response, not connection refused.
- Middleware-config returns 401 or 200; `000` means the app server remains down.
- Middleware responds on 3002.
- Port 8081 responds through nginx without 502.

Only after these pass:

```bash
pm2 save
pm2 startup
```

Run the command printed by `pm2 startup` if requested, then run `pm2 save` again.

## If it still fails

Do not restart again. Capture the actual startup error:

```bash
pm2 logs Qty_App --lines 80 --nostream
```

The repository follow-up will improve the deploy script's empty-file message, but no application-code change is required to resolve this confirmed empty `.env` failure.

## Security follow-up

The service-role key was pasted into chat and the middleware secret is weak. After login works, rotate that key and replace the middleware secret with a long random value in both `frontend/.env` and `middleware/.env`.