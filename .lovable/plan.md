# Fix: ZNFA Rating still calls Gate_Pass_Fetch_API on the middleware

## Root cause

In `src/lib/mm/gate-process.functions.ts` the DB lookup was switched to `ZNFA_Fetch_API`, but the proxy request URL is still hardcoded to `/gate_pass/Fetch`. The middleware maps that path to the `Gate_Pass_Fetch_API` config, so even though our server function loaded the ZNFA row from `sap_api_configs`, the proxy resolves the call back to `Gate_Pass_Fetch_API` and errors with `Config not found: Gate_Pass_Fetch_API` (because in this environment only ZNFA is configured).

## Change

Single edit in `src/lib/mm/gate-process.functions.ts`, proxy branch only:

- Stop hitting `${middlewareUrl}/gate_pass/Fetch`.
- Call the generic invoke route directly using the loaded config's id:
  - `target = ${middlewareUrl}/sap/invoke`
  - `body = { configId: cfg.id, inputs: { USER_ID: userId } }`
- Remove the 404-`Cannot POST` fallback block (no longer needed since we start on `/sap/invoke`).

This routes the request by the ZNFA config row we already fetched from the DB, so the middleware calls whatever endpoint that row defines — independent of URL path naming.

Nothing else changes: same input schema, same response parsing, same sync-log writes, same non-proxy (basic) branch, same UI. Admin must have `ZNFA_Fetch_API` configured (already the case per your logs).
