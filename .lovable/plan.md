# Plan: One Script to Sync All SAP API Settings to a Deployed Environment

## Goal
Give you a single file you can run on Quality or Production that installs/updates **all** SAP API Settings (endpoints + request/response mappings + roles/permissions), so nothing is missing after deployment.

## Why APIs go missing today
Deploying the app ships code only. SAP API Settings live in database rows (`sap_api_configs`, `sap_api_request_fields`, `sap_api_response_fields`). Each environment has its own database, so an API you created locally does not appear on the server until those rows are inserted there. Today the seed is split across three separate part files plus a separate SAP-connection file, which is easy to run partially — that is how gaps appear.

## What I will create
**`scripts/sync-sap-config.sql`** — one idempotent, re-runnable script that contains, in order and inside a single transaction:

1. All `sap_api_configs` rows (upsert by id, plus a name-based safety path so an existing `Login_API` row is reused instead of colliding).
2. All `sap_api_request_fields` rows (cleared and reinserted per config).
3. All `sap_api_response_fields` rows (cleared and reinserted per config).
4. Custom roles, role permissions, approval strategies, tenants.
5. A final verification block that prints row counts and lists any expected API name that is **missing** or **inactive**.

Environment-specific values (middleware URL/port, proxy secret, SAP base URL, SAP username/password) stay **out** of this script — they remain in `scripts/quality-sap-config.sql` so Quality and Production never overwrite each other.

## How you will run it
```bash
# Quality
docker exec -i supabase-db psql -U postgres -d postgres < scripts/sync-sap-config.sql

# Production (its own container/port)
psql "postgresql://postgres:<PASSWORD>@127.0.0.1:5442/postgres" -f scripts/sync-sap-config.sql
```
It is safe to run any number of times. The output at the end tells you immediately whether anything is still missing.

## Also included
- `scripts/make-quality-seed-no-login.py` updated so it emits this single combined file (the three part files stay available for the size-limited SQL editor).
- The Quality and Production runbooks get one clear mandatory step: run `scripts/sync-sap-config.sql` after schema setup, and again whenever a new SAP API is added locally.

## Technical notes
- All inserts use `on conflict ... do update`, so re-running refreshes changed endpoints/methods instead of erroring.
- Field-mapping tables are purged per `config_id` before reinsert, so removed mappings do not linger.
- Credentials (`sap_api_credentials`, `sap_global_secrets`) are never written by this script — no secrets in version control.
- The script does not touch `auth.*` or user data.

## Important ongoing rule
When a new SAP API is created in local SAP API Settings, it must also be added to this script before deploying. I can regenerate the script from the current local configuration whenever you ask.
