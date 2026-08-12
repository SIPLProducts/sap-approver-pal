# Fix the seed import error on Login_API

## What the error means

Your Quality database already has one SAP endpoint row named `Login_API` (that is the
single row your count query returned). The seed file matches existing rows by their
internal id, but this existing `Login_API` row was created directly on the Quality server,
so it has a *different* id than the one in the seed. Two rows with the same name are not
allowed, so the import stops at that line.

Nothing is wrong with the data being imported — the file just needs to clear the way for
rows that already exist under the same name.

## The fix

Regenerate `scripts/quality-seed-data.sql` with one extra step at the top, before any
endpoint is inserted:

1. Remove any existing endpoint row whose **name** matches a name in the seed but whose
   id is different. Its request/response field mappings are removed with it (they are
   fully re-created later in the same file), so nothing is lost.
2. Then run the existing endpoint inserts unchanged (still upserts on id, so re-running
   the file stays safe).
3. Apply the same name-based cleanup for `custom_roles`, which also has a unique name.

Everything runs inside the existing single transaction: if any part fails, the database is
left exactly as it was.

## How you will use it

Same command as before, on the Quality server:

```bash
docker exec -i supabase-db psql -U postgres -d postgres < quality-seed-data.sql
```

The file ends with the count check. Expected after a successful load:

- endpoints 47, request fields 406, response fields 755
- custom roles 8, role permissions 397, approval strategies 17

Then run `quality-sap-config.sql` once to set the SAP base URL, technical user password
and middleware secret for that server.

## Technical notes

- Cleanup uses `delete from public.sap_api_configs where name in (...) and id not in (...)`
  with the literal name/id lists from the generated seed; child field-mapping rows go via
  the existing cascade.
- No schema change and no migration — the file remains plain data SQL.
- `created_by` / `updated_by` stay `NULL` because those user ids do not exist in the
  Quality auth system.
