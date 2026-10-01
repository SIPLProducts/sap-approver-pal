# Keep SAP API Settings synchronized during deployment

## Goal
Ensure every API configured in the local/reference environment is installed and active in Quality or Production after deployment.

## Recommended process
1. Regenerate `scripts/sync-sap-config.sql` from the environment that contains the complete API list:
   ```bash
   python3 scripts/generate-sap-sync.py
   ```
2. Copy the generated SQL file to the target server.
3. Run it against the target database with errors stopping immediately:
   - Quality:
     ```bash
     docker exec -i supabase-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres < scripts/sync-sap-config.sql
     ```
   - Production:
     ```bash
     psql "postgresql://postgres:<PASSWORD>@127.0.0.1:5442/postgres" -v ON_ERROR_STOP=1 -f scripts/sync-sap-config.sql
     ```
4. Confirm the script finishes successfully and its final missing/inactive API check is empty.
5. Repeat the sync whenever a new API or request/response mapping is added locally.

## Safety boundaries
- The sync is idempotent and safe to run repeatedly.
- It synchronizes API endpoints, field mappings, roles, permissions, tenants, and approval strategies.
- It does not overwrite environment-specific middleware settings, proxy secrets, SAP base URLs, or SAP credentials.
- If the command reports an error, stop and fix the first error before assuming the APIs were synchronized.

## Technical details
SAP API Settings are database rows, not frontend build files. A frontend deployment alone cannot transfer them between environments. The generated sync file matches endpoint configurations by name and performs the synchronization in one transaction.
