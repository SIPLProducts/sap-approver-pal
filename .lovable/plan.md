# Fixing the Quality login page — explained simply

## What is broken right now (two separate problems)

**Problem 1 — the app server never starts.**
Your `dist/` folder has two parts that must agree with each other:

- `server/index.mjs` — the real application (built by the build).
- `start.mjs` — a small starter file whose only job is to run that application.

The starter is written to expect the application in one particular shape.
The build produced it in a different (also valid) shape. So the starter says
"this is not a usable build" and exits. PM2 then keeps retrying and gives up
(`status: errored`, restarts = 31).

Because nothing is listening on port 8080, Nginx on 8081 has nothing to talk to,
so the browser gets errors and no login page.

**Problem 2 — a React error inside the built application.**
`TypeError: jsxDevRuntimeExports.jsxDEV is not a function`

React has two internal modes: a *development* mode and a *production* mode.
The built server file is mixing them — it asks for a development-only function
that does not exist in the production build. Even after Problem 1 is fixed, this
would make pages fail to render on the server.

These two problems are unrelated. Both must be fixed, or you will fix one and
still see a broken site.

## What I will change (all on the build side, not your app screens)

**1. Make the starter accept both shapes**
`start.mjs` will check the application it just loaded:

- if the application expects the starter to open the network port, the starter
  opens it (today's behaviour), or
- if the application already opens its own port, the starter simply lets it do
  that instead of exiting with an error.

Either way port 8080 comes up. I will also fix a small bug where the starter
passes the port number where the host address belongs.

**2. Fix the React development/production mixing**
The build will be told, from the very first moment, to use React's production
mode consistently. I will then look inside the freshly built server file for any
leftover development-mode references and remove the cause in the build
configuration. I will not hand-edit generated files, because the next build would
overwrite that.

**3. Make the build refuse to produce a broken folder**
This is the part that stops the repeated cycle you have been living through.
Today the check only confirms *files exist*. After this change, the build will
actually:

- start the built server on a temporary spare port,
- wait for it to answer,
- request `/login` and one asset file,
- shut it down again.

If it does not start, or `/login` errors, the build **fails** and no archive is
produced. So a folder that cannot run can no longer reach your server.

**4. Remove the stale-page problem for good**
The old 404 errors (files like `index-BefOrEbA.js`) came from Nginx serving an
old saved page. The corrected Nginx file already in the project sends normal
pages to the app server and serves only the versioned `/assets/` files from disk.
The deployment helper will also fail loudly if it detects the old behaviour, and
I will include a one-time step to clear the old cached service worker in the
browser.

Note: a `index.html` in the root of `dist/` is intentionally *absent* in this
setup. The app server builds each page. Putting one back is what caused the
original 404 errors, so it stays out.

## What you will do afterwards (short and fixed)

On your development machine, in the project folder (**not** inside `dist/`):

```bash
npm run build:selfhost
npm run package:dist
```

If either command fails, the folder was broken and must not be copied — that is
the new safety net working.

Then copy `quality-frontend-dist.tar.gz` to the server and:

```bash
cd /data/webapplication/resl_approval/Quality/frontend
mv dist "dist-old-$(date +%Y%m%d-%H%M%S)"
mkdir dist && tar -xzf quality-frontend-dist.tar.gz -C dist
cd dist && bash deploy-frontend.sh
```

Nothing about the database, SAP middleware, or your application screens changes.

## How we will know it is actually fixed

- `pm2 ls` shows `Qty_App` as **online**, not errored.
- `curl -I http://127.0.0.1:8080/login` returns `HTTP/1.1 200`.
- The browser shows the login page at port 8081 with no 404 asset errors.
- The `jsxDEV` error no longer appears in `pm2 logs Qty_App`.
