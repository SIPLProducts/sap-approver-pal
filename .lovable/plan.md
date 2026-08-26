# Plan: Fix SAP sync rollback and missing APIs

## Goal
Make the SAP API sync script run successfully on the Quality server and insert the missing APIs:

- Gate_Pass_Doc_F4_API
- SES_DELETE_API
- SES_FETCH_API
- SES_REJECT_API
- SES_RELEASE_API
- ZMIRS_DOC_F4_API

## Current finding
The sync file in this project already contains those six APIs, but the Quality run rolled back. Because it was inside one transaction, after the first SQL error every following command showed:

```text
current transaction is aborted, commands ignored until end of transaction block
ROLLBACK
```

The first real error is not included in the pasted output, so the fix should make the script easier to diagnose and more compatible with older Quality databases.

## Implementation steps
1. Update the SAP sync generator so endpoint upserts do not depend only on `ON CONFLICT (name)`.
2. Generate a safer `sync-sap-config.sql` that:
   - updates existing endpoint rows by `name`
   - inserts missing endpoint rows only when the name does not exist
   - avoids failing if the Quality database has an older/mismatched unique constraint setup
3. Make request/response field mapping target a single endpoint row per API name to avoid accidental duplicate field rows if the target database has duplicate API config names.
4. Add clear pre-flight verification SQL comments/commands so the server operator can capture the first real failing SQL error if another rollback happens.
5. Update the deployment notes with the exact rerun command from the project root:

```bash
cd /data/webapplication/resl_approval/Quality
docker exec -i supabase-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres < scripts/sync-sap-config.sql
```

## Validation
After applying the updated script on Quality, verify that the missing API check returns zero rows:

```sql
select name from public.sap_api_configs
where name in (
  'Gate_Pass_Doc_F4_API',
  'SES_DELETE_API',
  'SES_FETCH_API',
  'SES_REJECT_API',
  'SES_RELEASE_API',
  'ZMIRS_DOC_F4_API'
)
order by name;
```

Expected result: all six API names are present and active.
