# Plan: Find out why Preview never reaches the middleware

## What the checks show

- `ZNFA_PRINT_API` exists, is active, POST, fetch type.
- Global connection mode is `via_proxy` with a middleware URL set, so Preview should go through `/sap/invoke` like Display does.
- The sync log has recent successful rows for `ZNFA_DISPLAY_GET_API` and `ZNFA_NFA_GET_API`, but **zero rows ever** for `ZNFA_PRINT_API`. The print code writes a log row on both success and failure, so the call is failing *before* the outbound request — not in SAP and not in the middleware.
- The middleware itself is reachable and correctly rejects a wrong shared secret.

So the failure is inside the Preview server function before `fetch`, or the server function is never invoked (for example an auth/deploy-level rejection). The current UI swallows this into a generic "An unexpected error occurred while generating the preview", which hides the real cause. Diagnosis is not yet confirmed — the first step is to surface the real error.

## Step 1 — make the real failure visible

- `src/lib/mm/znfa-print.functions.ts`: log the resolved target URL, proxy mode, and whether a shared secret was found at the start of the handler; write an `error` sync-log row (with the reason) for every early-exit path — missing config, disabled config, proxy on but no middleware URL, missing shared secret — instead of throwing bare errors with no trace.
- `src/routes/_authenticated/mm.znfa-release.tsx`: in `printMutation.onError`, show the actual error message (and HTTP status text when present) in the dialog instead of the generic sentence.

## Step 2 — fix what the diagnostics reveal

Expected causes, each with its fix:

- **No shared secret resolved** (env `MIDDLEWARE_SHARED_SECRET` missing on the server, no `sap_global_secrets.proxy_secret`) → the middleware answers 401 and nothing reaches SAP. Fix: fall back to the same secret resolution the working Display path uses, and report the 401 body in the dialog.
- **Session expired / not signed in** → the protected server function returns 401 before the handler runs, which is exactly "no log row, no middleware call". Fix: surface an "your session expired, sign in again" message rather than a generic error.
- **Stale published build** → the deployed site does not yet contain the print server function, so the RPC 404s. Fix: publish after the change.

## Step 3 — verify

Open an NFA via both Release (click NFA No) and Display, click Preview, then confirm a new `ZNFA_PRINT_API` row appears in the sync log and the middleware log shows the `/sap/invoke` call with the payload `{ TYPE_NFA, ZRFQS:[{RFQ:""}], GET, REL_CODE, ZNFA_NUM, PRINT:"X" }`.

## Out of scope

- No change to the payload shape, the config, or the PDF/image rendering already built.
