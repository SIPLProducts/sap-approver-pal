# Finish the SAP API sync on Production

Your scripts folder has `sync-sap-config.sql` and a `sync.log`. The check file (`check-sap-config.sql`) is missing. You need it to confirm all 77 APIs arrived.

## Steps (on the Production server)

1. See whether the earlier run worked:
   ```bash
   cd /data/webapplication/resl_approval/Production/scripts
   grep -m1 "ERROR:" sync.log
   tail -n 20 sync.log
   ```
   - No `ERROR:` line and the log ends with `COMMIT` = the sync worked.
   - If you see an `ERROR:` line, nothing was changed. Send me that line.

2. Make sure `sync-sap-config.sql` is the new 77-API file (download `sync-sap-config-production.sql` from Files, rename it to `sync-sap-config.sql`):
   ```bash
   grep -c "insert into public.sap_api_configs" sync-sap-config.sql
   ```
   It should print **77**. If it prints a smaller number, replace the file and run it again:
   ```bash
   docker exec -i supabase-prod-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres < sync-sap-config.sql 2>&1 | tee sync.log
   grep -m1 "ERROR:" sync.log
   ```

3. Upload the missing check file: download `check-sap-config-production.sql` from Files and save it in this folder as `check-sap-config.sql`. Then run:
   ```bash
   docker exec -i supabase-prod-db psql -U postgres -d postgres < check-sap-config.sql
   ```
   You should see 77 active APIs, and sections 2, 3 and 4 should be empty.

4. Refresh SAP API Settings on Production. The badge should show **77 APIs**.

## Notes
- You don't need the `quality-seed-*` files for Production. Leave them alone.
- The sync is safe to run again. It doesn't change the middleware address, secrets, SAP address or SAP login.
- No app changes are needed. If you approve this plan, I'll put fresh copies of both files in Files.
