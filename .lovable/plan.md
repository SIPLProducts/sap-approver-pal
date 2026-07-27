## Root cause

The Reject button errors with `SAP API config "PO_Reject_API" not found` because `src/lib/mm/po-release.functions.ts` looks up the config by the exact name `PO_Reject_API`, but the row in `sap_api_configs` is stored as `PO_REJECT_API` (all caps). The lookup is case-sensitive, so the config is never found and the request never leaves the app — nothing hits the middleware.

Verified: `select name from sap_api_configs where name ilike '%reject%'` returns `PO_REJECT_API` (and `PO_Release_API` matches the Release constant, which is why Release works).

## Fix

In `src/lib/mm/po-release.functions.ts`:

- Change `const REJECT_CONFIG_NAME = "PO_Reject_API"` to `"PO_REJECT_API"` so the name matches the configured row exactly.

No other changes — payload shape, dialog, and reject flow already match the API spec from the previous turn.

## Out of scope

- No DB rename, no other config edits, no UI changes.