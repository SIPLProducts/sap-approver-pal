# Seed the Quality database, skipping Login_API

## Why the import stopped

Your Quality database already has one endpoint row named `Login_API`, created directly on
that server, so it carries a different internal id than the copy in the seed file. Names
must be unique, so the import failed on that line — and because the whole file runs as one
transaction, the rows inserted before it were rolled back. Ignoring the error is not an
option: everything after it fails too.

Since `Login_API` already works on that server, the right move is to leave that row alone.

## What will be delivered

A new file, `scripts/quality-seed-data-sql-editor.sql`, identical to the current seed except:

1. The `Login_API` endpoint row is **not** inserted — your existing row stays untouched
   (its endpoint URL and settings on the Quality server are preserved).
2. `Login_API`'s request/response field mappings are still loaded, but attached to *your*
   existing row by looking it up by name instead of by a fixed id.
3. All other 46 endpoints, their field mappings, custom roles, role permissions and
   approval strategies load exactly as before.
4. Runs as one transaction and is safe to re-run.

## How to run it

The file is large (about 750 KB), which the SQL editor will not accept in one paste, so it
will be split into numbered parts that each run standalone:

- part 1 — endpoints (46 rows) + custom roles + role permissions + approval strategies
- part 2 — request field mappings
- part 3 — response field mappings

Run part 1 first, then 2, then 3, in the SQL editor. If you prefer one shot, the single
combined file still works through psql:

```bash
docker exec -i supabase-db psql -U postgres -d postgres < quality-seed-data-sql-editor.sql
```

Expected counts at the end: endpoints 47 (46 seeded + your Login_API), request fields 406,
response fields 755, custom roles 8, role permissions 397, approval strategies 17.

Then run `quality-sap-config.sql` once to set that server's SAP base URL, technical user
password and middleware secret.

## Technical notes

- Field mappings for `Login_API` insert with
  `select id from public.sap_api_configs where name = 'Login_API'` as `config_id`, and the
  existing mappings for that config are deleted first so counts stay exact.
- Every other statement keeps `on conflict (id) do update`, so re-running is harmless.
- `created_by` / `updated_by` stay `NULL` — those user ids do not exist in the Quality auth
  system.
- No schema change and no migration; plain data SQL only.
