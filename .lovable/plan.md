# MIGO Execute: no response from SAP

## What is actually happening

The MIGO Execute call does reach the middleware, but the values never reach SAP.

The saved MIGO fetch API setting expects the fields **MBLNR**, **MJAHR**, **RELEASE**, **DISPLAY**, **CANCEL** (all upper case). The screen currently sends the document number and year as **mblnr** and **mjahr** (lower case). The middleware matches field names exactly, so it fills the document number and year in as blank and sends SAP an empty request — SAP then returns nothing, which is why the screen stays empty. In Postman the same payload works because the keys there are upper case.

The Check and Post calls are unaffected: their saved settings use lower case names that already match what the app sends.

## The fix

1. In `src/lib/mm/migo-release.functions.ts` (`fetchMigo`), send the document number and year under both spellings — `MBLNR`/`MJAHR` plus the existing `mblnr`/`mjahr` — so the request matches the saved field names regardless of how they were configured. `RELEASE`/`DISPLAY`/`CANCEL` stay exactly as they are today.
2. Keep the payload shape, the transaction-type flags, and all existing response parsing (`HEADER` / `DATA`) unchanged.
3. Add a clear message when SAP replies successfully but with no header and no rows, so the screen says "SAP returned no data for this document" instead of silently showing an empty table. Any SAP message text in the reply is shown verbatim.

No other screen, API setting, or logic is touched.

## Technical notes

- `buildRequestPayload` in `middleware/server.js` resolves each configured field with a case-sensitive `getNested(inputs, field.field_name)`, so `MBLNR` cannot pick up `mblnr`. Middleware code is left as is; the app supplies both keys.
- Extra keys in `inputs` are harmless: the middleware only forwards the fields listed in the API settings.
- Verification: typecheck, then run Execute for each of Release / Display / Cancel and confirm header and item rows populate.
