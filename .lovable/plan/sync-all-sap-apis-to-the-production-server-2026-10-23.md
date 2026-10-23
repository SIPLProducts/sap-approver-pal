# Sync all SAP APIs to the Production server

SAP API Settings are stored in the database, not in the app files, so deploying the app alone does not bring them over. Use the same two files already generated (`sync-sap-config.sql`, `check-sap-config.sql` — 77 APIs, field mappings, roles, permissions, strategies) and run them against the Production database.

## Steps (on the Production server)

1. Copy both files to `/data/webapplication/resl_approval/Production/scripts/`.
2. Run the sync into the Production database:
   ```bash
   cd /data/webapplication/resl_approval/Production/scripts
   docker exec -i supabase-prod-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres < sync-sap-config.sql 2>&1 | tee sync.log
   grep -m1 "ERROR:" sync.log
   ```
   No output = success. If an `ERROR:` line appears, nothing was changed — send that line.
3. Verify:
   ```bash
   docker exec -i supabase-prod-db psql -U postgres -d postgres < check-sap-config.sql
   ```
   Expected: 77 active APIs; sections 2, 3 and 4 empty.
4. Refresh SAP API Settings on Production — badge should show 77 APIs.

## If something fails
- Container name differs: run `docker ps` and use the Production database container name.
- If the files need regenerating, they will be rebuilt with `scripts/generate-sap-sync.py` and delivered again.

## Notes
- No app code changes. The sync is safe to re-run and does not touch Production's middleware address, secrets, SAP address or SAP login.
