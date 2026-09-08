# Fix MIGO Cancel failing in the app (works in Postman)

## What's wrong

The saved Cancel endpoint contains stray spaces:

```text
/mm_approve_mng/document_cancel// MVT_CANCEL?sap-client=300␠
```

There is a space before `MVT_CANCEL`, a doubled slash, and a trailing space. When the app calls SAP, the space is sent as `%20`, so SAP never reaches the real service and replies with the plain text `error code: 502` — which is exactly the message in the popup ("Invalid JSON from SAP: error code: 502"). In Postman the URL is typed cleanly, so it works.

The payload, method (PUT) and shape `{ "cancel": { "mblnr", "mjahr", "item": [ { "item" } ] } }` already match Postman and are sent verbatim (raw pass-through), so nothing about the payload logic changes.

## Changes

1. **Clean the endpoint before calling SAP** (`src/lib/sap/url.ts`, in `resolveSapUrl`): trim the endpoint and remove whitespace inside the path/query, and collapse accidental `//` in the path (keeping `http://` intact). This is a defensive fix that applies wherever endpoints are resolved, so a mistyped space in SAP API Settings can no longer break a call.

2. **Correct the stored MIGO_CANCEL endpoint** to:
   ```text
   /mm_approve_mng/document_cancel/MVT_CANCEL?sap-client=300
   ```
   If SAP genuinely expects the double slash, the cleaned value keeps working either way after step 1; the app-side clean-up is what fixes the request.

3. **No change** to `cancelMigo` payload building, credentials, proxy routing, sync logging, response parsing (`TYPE`/`MESSAGE`), the popup, or any other screen/API.

## Verification

- Typecheck (`bunx tsgo --noEmit -p tsconfig.json`).
- Re-run Cancel from the MIGO screen with a selected item and confirm the popup shows the exact SAP `MESSAGE` (either the "already cancelled/reversed" error or the "Material Document ... created" success).
