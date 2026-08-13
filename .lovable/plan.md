# Immediate fix: restore styled login and SAP sign-in on Quality

## Confirmed diagnosis

The screenshot shows server-rendered login HTML with browser-default styling, a broken logo, and non-functional controls. The checked build/deployment code confirms that the page depends on `/assets/*` for CSS and JavaScript and that SAP login depends on `/_serverFn/*` reaching the app server.

The current deploy helper only confirms that asset filenames exist on disk; it does not request the login page's actual CSS/JS through ports 8080 and 8081. Therefore a deployment can appear healthy while nginx or the running app serves those asset URLs incorrectly.

## Changes

1. **Make the repository nginx configuration match the required self-host layout**
   - Remove the disk `root` and `try_files` asset handling from the tracked Quality config.
   - Proxy `/assets/`, `/sw.js`, `/manifest.webmanifest`, app routes, `/_serverFn/`, and `/api/` to the Node app server on `127.0.0.1:8080`.
   - Keep `/mw/`, `/supabase/`, and `/studio/` on their existing upstreams.

2. **Strengthen the deployment health check**
   - Parse every CSS and JavaScript URL returned by `/login`.
   - Request each URL directly from port 8080 and through nginx on port 8081; fail deployment on any non-200 response or incorrect content type.
   - Verify the logo/manifest and make a harmless backend-route reachability request so an unbooted client or broken `/_serverFn/` proxy cannot be reported as a successful deployment.
   - Print the exact failing URL and HTTP status for immediate diagnosis.

3. **Keep the build output internally consistent**
   - Preserve the self-host layout: no root `index.html`, statics under `dist/assets`, Node server under `dist/server`, and `start.mjs` serving `dist/`.
   - Extend the local `verify-dist` boot test to probe CSS as well as multiple JavaScript chunks and the manifest.

## Recovery procedure on the Quality server

After pulling the fix, rebuild and replace the deployment as one unit—do not merge files into the current `dist`:

```bash
cd /data/webapplication/resl_approval/Quality/frontend
rm -rf dist .output .wrangler
npm ci
npm run build:selfhost
npm run package:dist
mv dist "dist-old-$(date +%Y%m%d-%H%M%S)"
mkdir dist
tar -xzf quality-frontend-dist.tar.gz -C dist
cp deploy/quality/nginx/resl-approval-quality-8081.conf /etc/nginx/conf.d/resl-approval-quality-8081.conf
nginx -t && systemctl reload nginx
cd dist
bash deploy-frontend.sh
```

Then open a new Incognito window at `http://10.150.150.130:8081/login`. This avoids the previously cached service worker and broken asset responses.

## Success criteria

- `/login` is fully styled and the logo loads.
- Every login CSS/JS asset returns HTTP 200 through both `127.0.0.1:8080` and `127.0.0.1:8081`.
- The SAP login request reaches the app server and middleware route.
- `deploy-frontend.sh` ends with `RESULT: PASS`; otherwise it names the exact failing URL.
