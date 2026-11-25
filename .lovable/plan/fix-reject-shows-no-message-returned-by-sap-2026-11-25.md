# Fix: Reject shows "No message returned by SAP"

## Cause
In SAP API Settings, **Finace_Reject_API** is saved with method **GET**, while **Finace_Approve_API** (same SAP address) uses **PUT**. A GET request carries no body, so SAP never receives the `reject` record and replies with nothing — the popup then says "No message returned by SAP". The screen code builds the reject payload correctly.

## Change
1. Update the saved setting for Finace_Reject_API from GET to PUT (same as Approve). No screen code changes.
2. Regenerate the environment sync/check scripts so the published setup matches.
3. Retry Reject on a Pending row and confirm the popup shows SAP's MESSAGE (e.g. "Rejected Sucessfully").

You can also make step 1 yourself in SAP API Settings → Finace_Reject_API → Method = PUT.

## Technical details
- `sap_api_configs.http_method` for `Finace_Reject_API` → `PUT`.
- Rerun `scripts/generate-sap-sync.py` to refresh `scripts/sync-sap-config.sql` and `scripts/check-sap-config.sql`.
