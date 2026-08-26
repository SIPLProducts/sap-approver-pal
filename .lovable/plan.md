# Plan: Fix Missing SAP APIs After Deployment

## Goal
Make deployed environments show the same SAP API Settings as local, without manually recreating missing APIs one by one.

## What I confirmed
- The app stores SAP API Settings in database tables such as `sap_api_configs`, `sap_api_request_fields`, and `sap_api_response_fields`.
- Deployment docs already rely on seed SQL for SAP API endpoints and mappings.
- The current seed SQL includes many newer APIs, including examples like `Get_Search_Term`, `GET_USER_PLANT`, `MIGO_Fetch_API`, and related MM/SD endpoints.
- The SAP API Settings UI currently lists/edits endpoints, but there is no visible export/import/sync action in the main settings screen.

## Why APIs can be missing after deployment
Frontend deployment only deploys code. It does not automatically copy local database rows into the deployed database.

So if an API was created or updated in local SAP API Settings, it must also be inserted/upserted into the target database during deployment. Otherwise the deployed app will run with an older or incomplete `sap_api_configs` set.

## Immediate recovery steps
1. On the target environment, check which SAP APIs are missing:
   ```sql
   select name, module, endpoint_url, http_method, is_active
   from public.sap_api_configs
   order by name;
   ```
2. Compare that list with local.
3. Re-run the latest SAP seed SQL against the target database:
   - `scripts/quality-seed-data-sql-editor.sql` for full SAP API configs, request fields, response fields, roles, and screens.
   - Keep environment-specific values separate: middleware URL, middleware secret, SAP base URL, SAP username/password.
4. After seed runs, update only the target environment middleware/SAP connection rows so Quality and Production do not point to the wrong server/port.
5. Test the missing API from **Admin → SAP API Settings → APIs → Test**.

## Code/documentation improvement I will make after approval
1. Add a deploy-safe SAP API sync script that upserts all API configs and field mappings using stable names, so it can be re-run safely on Quality or Production.
2. Add a small verification SQL/script that reports:
   - total API config count,
   - missing required API names,
   - inactive required API names,
   - configs without request/response mappings where mappings are expected.
3. Update the deployment runbooks with a clear mandatory step: “Run SAP API seed/sync after backend schema setup and after any new SAP API is added locally.”
4. Add a short checklist explaining that frontend build/deploy will not transfer SAP API Settings rows.

## Important rule going forward
Whenever a new SAP API is added in local SAP API Settings, also export/add it to the seed/sync SQL before deployment. Code changes alone are not enough because the deployed database has its own data.
