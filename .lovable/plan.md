## Goal

1. In **Service Certificate & SO Approval Reports**, show two extra columns straight from the SAP response:
   - `DATA[].RELEASE_CODE1` → column "Release Code 1"
   - `DATA[].APPROVAL_STATUS` → column "Status"
2. Ensure the logged-in user's SAP user id is sent as `USER_ID` in the `Sevice_Certificate_Fetch` payload.

## Changes

### `src/lib/sd/sc-so-approval.functions.ts`
- Extend `ScSoRow` with two fields:
  - `release_code_1: string | null`
  - `approval_status: string | null`
- In `mapRow()`, populate them via `pick(raw, "RELEASE_CODE1")` and `pick(raw, "APPROVAL_STATUS")`.
- Extend `ScSoRowSchema` and `toSapScSoRow()` to round-trip these fields on the accept/reject submit (as `RELEASE_CODE1` / `APPROVAL_STATUS`) so nothing is lost when the row is echoed back to SAP.
- USER_ID handling: already resolved from `data.user_id → profiles.sap_user_id (login user) → field default`. Keep the fallback but make it explicit that the authenticated profile's `sap_user_id` is used whenever the caller does not provide one. No API shape change — payload key stays `USER_ID`.

### `src/routes/_authenticated/sd.sc-so-reports.tsx`
- Pass options to `buildDynamicColumns(rows, …)`:
  - `alwaysInclude: ["release_code_1", "approval_status"]` so the columns render even when the first page has empty values.
  - `headerLabels: { release_code_1: "Release Code 1", approval_status: "Status" }`.
- The values render verbatim (existing `FORCE_TEXT_KEYS` / text-first logic already prevents date/number reformatting for identifier-like strings; `release_code_1` will be added to `FORCE_TEXT_KEYS` in `src/lib/sd/dynamic-columns.tsx` alongside the existing `rel_1…rel_8` entries so 8-digit codes like `22011840` display exactly as returned).

### `src/lib/sd/dynamic-columns.tsx`
- Add `"release_code_1"` and `"approval_status"` to `FORCE_TEXT_KEYS` so both columns are treated as raw text (no date/number formatting).

## Out of scope

- No changes to the main `/sd/sc-so` approvals screen columns.
- No changes to Contract or Sales Order reports.
- No change to the SAP API config, endpoint, or auth.

## Verification

- `tsgo` typecheck.
- Open Service Certificate & SO Approval Reports, run Execute; confirm two new columns "Release Code 1" and "Status" appear with the exact SAP values, and network payload shows `USER_ID` populated with the logged-in user's SAP id.
