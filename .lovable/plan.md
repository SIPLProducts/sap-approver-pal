# Generate the SAP API sync file for the Quality server

## What you will get
Two ready-to-download files in Files:
- `sync-sap-config.sql` — installs/updates every SAP API from the current setup (endpoints, request/response mappings, roles, permissions, approval strategies). Safe to run more than once.
- `check-sap-config.sql` — read-only check that lists the active API count and any missing or inactive APIs.

## Steps
1. Regenerate both files from the current database so they include every API shown in SAP API Settings.
2. Confirm the file lists the same API count as the SAP API Settings badge.
3. Save both files to Files for download.

## How to import on the Quality server
```bash
cd /data/webapplication/resl_approval/Quality/scripts
docker exec -i supabase-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres < sync-sap-config.sql 2>&1 | tee sync.log
grep -m1 "ERROR:" sync.log
docker exec -i supabase-db psql -U postgres -d postgres -f check-sap-config.sql
```
- No `ERROR:` line = success. The check should show the full API count and empty MISSING/INACTIVE lists.
- Production: use `supabase-prod-db` instead of `supabase-db`.

## Safety
- Does not change the server's middleware URL, proxy secret, SAP base URL or SAP credentials.
- Runs in one transaction; if anything fails, nothing is half-applied.

## Technical details
Generated with `scripts/generate-sap-sync.py`, which writes both files together so the check matches the sync list. No app code changes.
