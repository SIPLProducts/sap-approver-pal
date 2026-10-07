# Run the SAP API sync on Quality

The sync files are now on the Quality server at `/data/webapplication/resl_approval/Quality/scripts/`. Remaining work is on that server: run the sync, then verify all 71 APIs appear.

## Steps (run on the Quality server)

1. From the Quality scripts folder, run the sync into the database container:
   ```bash
   cd /data/webapplication/resl_approval/Quality/scripts
   docker exec -i supabase-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres < sync-sap-config.sql 2>&1 | tee sync.log
   ```
2. Check for errors:
   ```bash
   grep -m1 "ERROR:" sync.log
   ```
   - No output = the sync completed cleanly.
   - If an `ERROR:` line appears, stop and share that first error line — do not re-run blindly.
3. Run the read-only verification:
   ```bash
   docker exec -i supabase-db psql -U postgres -d postgres -f check-sap-config.sql
   ```
   - Expected: active API count = **71**, and the MISSING/INACTIVE lists are empty (0 rows).
4. Refresh the SAP API Settings page on Quality — the count badge should show **71 APIs**.

## If something fails

- `docker exec` errors (container name differs): list containers with `docker ps` and use the actual database container name in place of `supabase-db`.
- Any `ERROR:` from step 2 or missing APIs in step 3: send the output here and it will be fixed.

## Notes

- No app code changes are needed; this is a database sync only.
- The sync is idempotent — safe to re-run if interrupted.
