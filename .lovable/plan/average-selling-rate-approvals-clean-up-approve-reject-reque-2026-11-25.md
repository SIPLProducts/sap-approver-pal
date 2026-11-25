# Average Selling Rate Approvals: clean up Approve/Reject request fields

## What I found
- The screen already sends exactly the requested payload for both Approve and Reject, with AVG_RATE taken from the selected row's Average Selling Rate. No FIN_RATE is sent by the screen.
- The saved request field list in SAP API Settings still differs from the payload:
  - AVG_Approvals_Approve_API lists `approve.FIN_RATE`, and `approve.AVG_RATE` sits last.
  - AVG_Approvals_Reject_API lists `reject.FIN_RATE`, and `reject.AVG_RATE` is set as a fixed (static) value instead of a row value.

## Changes
1. In SAP API Settings, for both APIs:
   - Remove the `FIN_RATE` request field.
   - Set `AVG_RATE` to come from the row (column), like the other fields.
   - Move `AVG_RATE` to sit right after `NAME1`, matching the payload order you gave.
2. Regenerate the environment sync and check scripts so other environments get the same settings.
3. No screen code, popup, or other API changes.

## Technical details
- Update `sap_api_request_fields` for configs AVG_Approvals_Approve_API and AVG_Approvals_Reject_API: delete `*.FIN_RATE` rows, set `*.AVG_RATE` source = `column`, renumber sort_order so the order is MANDT, WERKS, KUNNR, MATERIAL, NAME1, AVG_RATE, UPDATED_BY, UPDATED_ON, APPROV_BY, STATUS.
- Run `scripts/generate-sap-sync.py` to rewrite `scripts/sync-sap-config.sql` and `scripts/check-sap-config.sql` together.
- `imw.average-selling-rate-approvals.tsx` stays unchanged (already binds `row.AVG_RATE`).
