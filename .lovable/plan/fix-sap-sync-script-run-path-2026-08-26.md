# Fix SAP sync script run path

## What happened

The sync script exists as `scripts/sync-sap-config.sql` in the project, but your terminal was already inside the `scripts` folder:

```text
/data/webapplication/resl_approval/Quality/scripts
```

From inside that folder, `scripts/sync-sap-config.sql` points to:

```text
/data/webapplication/resl_approval/Quality/scripts/scripts/sync-sap-config.sql
```

That nested path does not exist, so Bash shows `No such file or directory`.

## Correct command

If you are already inside the `scripts` folder, run:

```bash
docker exec -i supabase-db psql -U postgres -d postgres < sync-sap-config.sql
```

If you are in the project root folder, run:

```bash
docker exec -i supabase-db psql -U postgres -d postgres < scripts/sync-sap-config.sql
```

## Plan

1. Update the Quality deployment instructions to show both command variants:
   - From project root
   - From inside the `scripts` folder
2. Add a quick pre-check command so this is easy to verify before running:

```bash
ls -lh sync-sap-config.sql
```

or from project root:

```bash
ls -lh scripts/sync-sap-config.sql
```

3. Keep the script itself unchanged because the issue is the shell path, not the SQL content.

## Technical details

No database schema or app code changes are needed. This is only a deployment command/path correction.
