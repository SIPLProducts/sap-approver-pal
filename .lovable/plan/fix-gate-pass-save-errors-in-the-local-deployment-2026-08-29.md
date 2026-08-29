# Fix Gate Pass Save errors in the local deployment

## Confirmed cause
- `saveGatePass` calls the middleware without `raw: true`.
- The middleware applies configured response-field mappings unless `raw: true` is sent. For a SAP response such as `{"MESSAGES":[{"TYPE":"E","MESSAGE":"Please maintain remarks"}]}`, those mappings can remove the `MESSAGES` array before the Gate Pass error parser receives it.
- The Material Reservation save flow already avoids this issue by requesting the raw middleware response.
- Publishing the Lovable-hosted app does not replace the separately deployed local/self-hosted frontend bundle.

## Changes
1. Update only the Gate Pass Save middleware request to include `raw: true`, preserving the complete SAP response for the existing exact-message checks.
2. Keep the current failure behavior: return `ok: false`, display only the exact `MESSAGE`, retain selection/results, and skip refresh/success cleanup.
3. Add regression coverage for the full middleware envelope and JSON-encoded response forms, including `STATUS: "FALSE"` and `TYPE: "E"` / `MESSAGES` errors.

## Verification
- Run the focused SAP message tests and project checks.
- Verify the Save result does not enter the success branch for `Please maintain remarks`.
- Build a fresh self-host package so the server function change is included in `dist/server`, then deploy into an empty local `dist/` and restart the local app server. The standalone middleware does not require a code change for this fix.
