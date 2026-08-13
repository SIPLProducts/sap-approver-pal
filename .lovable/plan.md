# Restore the styled login page on the Quality server

## Confirmed cause

The deployed `/login` HTML is reaching the browser, but its CSS and JavaScript are not. The latest self-host package stores browser files under `dist/client/assets`, while the checked-in Quality Nginx configuration still intercepts `/assets/` using a root that resolves to `dist/assets`. This produces the unstyled page in the screenshot and prevents the login JavaScript from running.

## Changes

1. **Use one source for application files**
   - Update the Quality Nginx configuration so pages, `/assets/*`, the service worker, and the manifest are all proxied to the app server on port 8080.
   - Remove the conflicting static-file locations that assume assets live directly under `dist/`.
   - Keep the existing backend, middleware, and Studio proxy routes unchanged.

2. **Make deployment reject this exact failure**
   - Extend `deploy-frontend.sh` to fetch the rendered login page through public port 8081, extract its CSS/JS references, and require each URL to return HTTP 200.
   - Detect HTML returned for a JavaScript/CSS URL, not only missing files, so a bad Nginx fallback also fails.
   - Run these checks after restart and print the exact failing asset URL.

3. **Align deployment instructions**
   - Update the Quality deployment guide to use the corrected Nginx configuration and remove the outdated `dist/assets` layout description.
   - Include the one-time Nginx copy/test/reload commands required on the Quality server.

## Verification

- Build and package the self-host archive using the existing verified workflow.
- Confirm direct port 8080 serves `/login` and its referenced CSS/JS.
- Confirm public port 8081 serves the same assets with correct content types.
- Confirm the login page is styled and interactive in a fresh incognito window.

## One-time server action after receiving the updated files

```text
Install the updated Nginx config
Run nginx -t
Reload Nginx
Extract the new archive into an empty dist folder
Run bash deploy-frontend.sh
```

No SAP API, database, authentication, or middleware behavior will be changed.
