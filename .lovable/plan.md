# Make Last Name Optional in User Creation

## What the screenshot shows
The form already displays Last Name without a required marker, and the client/server validation allows it to be blank. The Create User API configuration still marks `CREATE.LAST_NAME` as required, which triggers the red validation message when Save is clicked.

## Change
- Turn off the Required setting for `CREATE.LAST_NAME` in the existing Create User API request-field configuration.
- Keep the form, payload structure, SAP integration, and all other validations and behavior unchanged.
- Regenerate `scripts/sync-sap-config.sql` and `scripts/check-sap-config.sql` together using the existing generator so the environment configuration stays consistent.

## Verification
Confirm a new user can be submitted with Last Name blank and that the API no longer rejects the request for `CREATE.LAST_NAME`; confirm the remaining required fields behave as before.
