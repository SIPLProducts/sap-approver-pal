# SAP API config sync confirmation

Yes — when you run this command from the Quality project root:

```bash
cd /data/webapplication/resl_approval/Quality
docker exec -i supabase-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres < scripts/sync-sap-config.sql
```

it is intended to sync all SAP API configs included in `scripts/sync-sap-config.sql`, including the recently missing APIs such as:

- `Gate_Pass_Doc_F4_API`
- `SES_FETCH_API`
- `SES_DELETE_API`
- `ZMIRS_DOC_F4_API`

## Important condition

All configs will be applied only if the command finishes without any `ERROR` and reaches the final verification section.

If you see any `ERROR`, then `psql -v ON_ERROR_STOP=1` stops at the first failing statement. In that case, do not assume all 53 configs were inserted; share the first error line and it should be fixed first.

## What success should look like

After the command completes successfully, the final check in the SQL should show no missing API names. If it prints rows under a `problem` or `MISSING` column, those APIs still did not sync.

## If you want to verify manually

Run this after the sync:

```bash
docker exec -i supabase-db psql -U postgres -d postgres -c "select count(*) from public.sap_api_configs;"
```

This count may be more than 53 if your database already has extra or duplicate configs, so the better verification is the script's final missing-API check.
