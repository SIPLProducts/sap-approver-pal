# Fix: "Cannot POST /price_approval/Fetch" (404 from middleware)

## Root cause
The app now calls `POST {middleware}/price_approval/Fetch`, but the middleware process running on your machine is **an older copy of `middleware/server.js`** that doesn't have that route yet. Express replies with its default 404 page ("Cannot POST /price_approval/Fetch"), which the app shows as "SAP returned 404".

The updated `middleware/server.js` in this project already contains the route — it just hasn't been copied to your machine and restarted.

## What I'll change in the app (so this can never break again)

**`src/lib/sd/price-approval.functions.ts`** — add an automatic fallback:
1. Try `POST {middleware}/price_approval/Fetch` with `{ inputs }` (nice readable name in logs).
2. If the response is a 404 whose body contains `Cannot POST` (old middleware), automatically retry `POST {middleware}/sap/invoke` with `{ configId, inputs }` — the route every middleware version has.
3. Surface a clearer error message if both fail ("Middleware is outdated — copy the latest middleware/server.js and restart it").

No database, UI, or middleware-file changes needed.

## What YOU must do (required for the named endpoints to appear)
1. Copy the latest `middleware/server.js` from this project to your machine (replace the old file).
2. Stop the running middleware (Ctrl+C) and start it again: `node server.js`.
3. On startup you should see it listening; then click **Execute** — the network log will show `POST /price_approval/Fetch 200`.

Until you restart with the new file, the fallback will keep things working via `/sap/invoke`.
