## Root cause

The app and Postman receive the **same** SAP payload — confirmed by `sap_api_sync_log` rows showing the raw `DATA[]` returned to the proxy. Postman shows the raw JSON, so it looks "correct". The React table renders `—` because the column-schema keys in `src/routes/_authenticated/sd.bmw-status.tsx` don't match the abbreviated keys SAP actually sends. No payload/request difference exists; this is purely a response-key mismatch on the client.

## Fix

Update only the column-key constants in `src/routes/_authenticated/sd.bmw-status.tsx` to match the real SAP keys observed in production sync logs. No hardcoded data, no server-function changes, no admin-config changes.

### Key remapping

Business Partner group (`BP_COLS`):
- `BP_REGISTRATION_DATE` → `BP_REG_DATE`
- `BP_NO_BEDS_INVOICED` → `BP_NO_BEDS_INV`
- `BP_AGREEMENT_VALID_FROM` → `BP_AGR_FROM`
- `BP_AGREEMENT_VALID_TO` → `BP_AGR_TO`

Contract group (`CONTRACT_COLS`):
- `CONT_CREATION_DATE` → `CONTRACT_DATE`
- `CONT_CREATED_BY` → `CONTRACT_CREATED_BY`
- `CON_SERVICE_VALID_FROM` → `CON_SERVICE_VALID_FRM`
- `CON_SERVICE_START_DATE` → `CON_SERVICE_START_DT`
- `CON_REGISTRATION_DATE` → `CON_REG_DATE`
- `CON_NO_BEDS_INVOICED` → `CON_NO_BEDS_INV`
- `CON_AGREEMENT_VALID_FROM` → `CON_AGR_FROM`
- `CON_AGREEMENT_VALID_TO` → `CON_AGR_TO`

Other groups (Core, MBD, releases `REL_n_C`/`STATUS_n_C`/`APP_REJ_DATE{n}_C`/`APP_REJ_REASON{n}_C`, PH, Service Cert, PH Sales, Sales Order, sales releases `REL_n`/`STATUS_n`/..., Billing) already match the sync-log keys and stay as-is.

### Verification

1. Re-run a Customer-mode search; BP and Contract columns should populate (e.g. `BP_REG_DATE` = `2024-01-12`, `BP_AGR_TO` = `2024-12-12`).
2. Switch to Contract mode and confirm `REL_1_C`/`STATUS_1_C` populate when present.
3. Switch to Sales Order mode and confirm Billing/Accounting docs render.
4. Inspect `sap_api_sync_log` to confirm no new keys are introduced for sales-mode columns; adjust only if a real sales-mode response reveals further abbreviations.
