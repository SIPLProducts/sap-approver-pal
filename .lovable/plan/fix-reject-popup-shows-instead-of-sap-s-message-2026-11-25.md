# Fix: Reject popup shows "-" instead of SAP's MESSAGE

## What we know
- The popup shows "-" with a green tick. That means the app got a reply from SAP for Finace_Reject_API but couldn't find a MESSAGE in it.
- The SAP API Settings for Finace_Reject_API (TYPE and MESSAGE fields) match Finace_Approve_API, so the settings themselves look fine.
- The exact cause is not confirmed yet. Most likely SAP sends the reject reply in a different shape than the documented `[{ TYPE, MESSAGE }]` (for example a single object, a wrapped object, or text), and the field mapping drops the MESSAGE.

## Steps
1. Find out exactly what SAP returns: send one reject from the server and record the raw reply. This rejects one real record. I'll use the first Pending record for plant 3601 unless you name a different one.
2. Fix where the reply is read so MESSAGE and TYPE are found in whatever shape SAP really uses (an array, a single object, a wrapped object, or a JSON string). The popup will show only SAP's exact MESSAGE. TYPE "E" will show as an error, and a record will only disappear from the table when TYPE is "S".
3. If no MESSAGE comes back at all, show "No message returned by SAP" with an error icon instead of "-" and a green tick, so a missing reply never looks like a success.
4. Approve uses the same reading code, so it gets the same fix. Nothing else changes.

## Technical details
- File: `src/routes/_authenticated/imw.financial-year-base-rate-approvals.tsx`, in `pickSapMessage`. Search the reply at any depth for MESSAGE and TYPE, in upper or lower case. If the reply is a string, parse it as JSON first.
- If step 1 shows the middleware mapping `[].MESSAGE` removes an object-shaped reply, change only Finace_Reject_API's response field paths to match. Then regenerate both `scripts/sync-sap-config.sql` and `scripts/check-sap-config.sql` with `scripts/generate-sap-sync.py`.
