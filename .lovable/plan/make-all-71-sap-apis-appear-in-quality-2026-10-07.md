# Make all 71 SAP APIs appear in Quality

## What I checked
- Local has exactly 71 APIs, all active, with 71 unique names.
- The sync file `scripts/sync-sap-config.sql` already contains all 71 APIs, plus their request/response mappings, roles, permissions and strategies.
- The SAP API Settings screen lists every row in the database with no filter, so if a row exists in Quality it will show.

So the app code is fine. In Quality, one of these is happening (I can't see Quality's database from here, so which one is not confirmed yet):
1. The sync file was not run on Quality, or an older 53-API copy was run.
2. The sync was run but stopped on an error. Everything runs as one batch, so a single error means none of the 71 are saved.
3. The sync ran against a different database than the one the Quality app uses (for example, the wrong container, or the app's backend address pointing somewhere else).
4. Quality's database structure is older than local's (for example, it doesn't accept the `COMMON` module), so some rows are rejected.

## What I will add (no changes to existing app logic)
1. **A read-only check script**, `scripts/check-sap-config.sql`, to run on Quality before and after the sync. It changes nothing and shows:
   - the total and active API counts
   - the exact names of any of the 71 APIs that are missing or inactive
   - whether Quality's database accepts every module, method, auth type and request-field source the sync uses (catches cause 4)
   - mapping counts for each API, so incomplete APIs are easy to spot
2. **A small update to the generator**, `scripts/generate-sap-sync.py`, so it writes the check script each time it regenerates the sync file. The two files then always match.
3. **A clearer Quality runbook (DEPLOY-QUALITY.md section 3b)** with these steps:
   - Confirm the copy on the server is the new one: `grep -c "^update public.sap_api_configs" scripts/sync-sap-config.sql` should print **71**.
   - Confirm it's the right database: the `supabase-db` container must be the backend at the address in the Quality frontend's `VITE_SUPABASE_URL` (10.150.150.130:8000).
   - Run the check script, then the sync with `-v ON_ERROR_STOP=1`, and save the output: `... < scripts/sync-sap-config.sql 2>&1 | tee sync.log`.
   - If there's an error, use the first `ERROR:` line in `sync.log`. The runbook will list the common errors and how to fix each one.
   - Run the check script again. Done means it reports 71 APIs and no missing names. Then refresh SAP API Settings; the count should say **71 APIs**.

## Once you've run it
If the first run shows an error, send me the first `ERROR:` line, or the check script's output. I'll fix that specific problem and give you a new sync file.

## Technical details
- The check script uses the same `expected(name)` list as the sync footer. It compares Quality's `pg_constraint` CHECK definitions on `sap_api_configs`, `sap_api_request_fields` and `role_permissions` with the values the sync uses (`module` in MM/SD/COMMON, `api_type`, `auth_type`, `http_method`, `source`, `action`).
- The sync file's contents and behavior stay the same. Credentials, the middleware URL, the proxy secret and the SAP base URL are still never written.
