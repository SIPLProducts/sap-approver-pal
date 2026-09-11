# ZGP Report — Cancel fails with "config not found"

## Cause (confirmed)

The Cancel action looks for a saved SAP service named exactly `ZGP_Cancel_Report`, but the row saved in SAP API Settings is named `ZGP_CANCEL_REPORT`. The lookup is case-sensitive, so no match is found and the popup shows "SAP API config "ZGP_Cancel_Report" not found".

Checked in the database: `ZGP_CANCEL_REPORT` exists, is active, method PUT — the settings screen is correct; only the name matching is at fault.

## Fix

Make the cancel service lookup case-insensitive so any capitalisation of the saved name is found. Same change applied to the ZMC Report cancel lookup, so a future rename in settings cannot break it either.

Nothing else changes: the cancel payload, filters, PUT method, credentials, routing, logging, response messages, selection behaviour, and every other screen stay exactly as they are.

## Technical notes

- `src/lib/mm/zgp-report.functions.ts` (`cancelZgpRecords`) and `src/lib/mm/zmc-report.functions.ts` (`cancelZmcRecords`): replace `.eq("name", CANCEL_CONFIG_NAME)` with a case-insensitive match (`.ilike("name", CANCEL_CONFIG_NAME)`), keeping `maybeSingle()` and the existing not-found / disabled error messages.
- Verification: `bunx tsgo --noEmit -p tsconfig.json`, then run Cancel on a selected ZGP row and confirm the SAP MESSAGE appears in the response popup.
