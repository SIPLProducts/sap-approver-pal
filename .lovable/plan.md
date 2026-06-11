# Price Approvals — fix "0 records" and make the API names clear

## What's actually happening today

When you click **Execute**, the call path is:

```
Browser → Lovable Worker (server fn) → ngrok → Middleware POST /sap/invoke → SAP
```

In the middleware log you see `POST /sap/invoke 502 / 500`. That is the only path name today — every SAP call (Fetch, Approve, Reject, BP, DMS…) uses the same generic `/sap/invoke`, so you cannot tell from the log which business action was triggered.

## Why "Loaded 0 records from SAP" appears even though SAP responded

I checked the DB: `Price_Approval_Fetch` is configured with **14 response fields** (`SELECT_FLG`, `KEY_COMBINATION`, `CUSTOMER`, …) at the row level.

Middleware `server.js` runs `mapResponse(responseFields, raw)` on the SAP body. The function looks for each field at the **root** of the response:

```text
SAP returns:  { DATA: [ {SELECT_FLG: "X", CUSTOMER: "...", ...}, ... ] }
mapResponse picks raw.SELECT_FLG  →  undefined
                  raw.CUSTOMER    →  undefined
returns:      { SELECT_FLG: undefined, CUSTOMER: undefined, ... }   ← DATA array is GONE
```

The frontend then reads `sapJson.DATA` → undefined → 0 rows → toast shows "Loaded 0 records".
So SAP is replying fine, but the middleware is throwing the row array away before the app sees it.

## Plan

### 1. Make the middleware preserve list responses

Edit `middleware/server.js` `mapResponse(fields, raw)`:

- If `raw.DATA` or `raw.data` is an array → return `raw` unchanged (let the app/template do the row mapping). Response-field mapping in the middleware is only useful for single-object responses; for list endpoints it must pass through.
- Keep current behaviour for non-array responses (single-object endpoints still get mapped).

This single change makes the Price Approvals table populate with the real rows.

### 2. Add meaningful endpoint names on the middleware

Add named aliases in `middleware/server.js` so the middleware log clearly shows which business call happened:

```text
POST /price_approval/Fetch                 → invokes config "Price_Approval_Fetch"
POST /price_approval/Price_Approve_Reject  → invokes config "Price_Approve_Reject"
```

Implementation: a small helper `invokeByName(name, inputs)` that resolves the config id from a tiny in-memory name→id map (built lazily by calling the existing `/api/public/middleware/config` lookup once per name and cached for 30 s, same TTL as today). The handlers reuse `invokeSap` and `writeLog`, so behaviour is identical to `/sap/invoke` — only the URL is friendlier.

The existing `/sap/invoke` stays for backward compatibility (BP, DMS, etc., until you rename them too).

### 3. Point the app at the new names

- `src/lib/sd/price-approval.functions.ts` — change the proxied target from `${middlewareUrl}/sap/invoke` (body `{configId, inputs}`) to `${middlewareUrl}/price_approval/Fetch` (body `{inputs: {PLANT, USER_ID}}`).
- (Future) When the Accept/Reject buttons are wired to SAP, they will POST to `${middlewareUrl}/price_approval/Price_Approve_Reject`.

### 4. Verify

After the change, middleware logs will read:

```text
POST /price_approval/Fetch                 200   (was POST /sap/invoke)
POST /price_approval/Price_Approve_Reject  200
```

and the Price Approvals screen will show the rows returned by SAP for plant `3806` / user `NEOBMWCONS`.

## Files touched

- `middleware/server.js` — fix `mapResponse` for arrays + add named routes (`/price_approval/Fetch`, `/price_approval/Price_Approve_Reject`).
- `src/lib/sd/price-approval.functions.ts` — call the named endpoint instead of `/sap/invoke`.

No database migration, no UI change, no schema change. After you redeploy the middleware (restart `node server.js`), wait ~30 s for the config cache to expire and click Execute again.

Shall I implement?
