# Add USER_ID to SES_FETCH_API payload

## What changes
Every Service Entry Sheet fetch sends one new key, `USER_ID`. Its value is the SAP user ID of the person who is signed in. All other keys and values stay exactly as they are.

## Steps
1. In the Service Entry Sheet fetch (`src/lib/mm/ses.functions.ts`), find the signed-in user's SAP ID from their profile (`profiles.sap_user_id`) on the server for each request. Use the same pattern the SC/SO approval fetch already uses.
2. Add `USER_ID: <signed-in user's SAP ID>` after `SCOPE_OF_LIST` in the existing `inputs` object. The ID is never hardcoded.
3. Register `USER_ID` as a request field (source column, optional, sort order 26) on `SES_FETCH_API` with a small data migration. The middleware only forwards fields that are registered, so this step is needed when requests go through the middleware.
4. Regenerate `scripts/sync-sap-config.sql` and `scripts/check-sap-config.sql` together with `scripts/generate-sap-sync.py`.

## Unchanged
Every other payload key, the filters, the response handling, the UI and all other APIs.

## Technical details
- The handler gets `context` from `requireSupabaseAuth`, so it reads `context.userId` and then the profile.
- If the profile has no SAP ID, it sends an empty string instead of a made-up value.
