# Make PLANT / USER_ID dynamic (Price + Contract)

## Root cause

The middleware honors the request-field config in `sap_api_request_fields`. For **Price_Approval_Fetch** both `PLANT` and `USER_ID` are stored with `source = 'static'` and `default_value = '3806' / 'NEOBMWCONS'`. The middleware's `resolveRequestField` for `static` returns `default_value` unconditionally and ignores the caller's `inputs`, so the values typed in the UI (e.g. `3801` / `SARVI_INFO1`) never reach SAP.

Current DB state:

```text
Price_Approval_Fetch    PLANT      static   3806
Price_Approval_Fetch    USER_ID    static   NEOBMWCONS
Contract_Approval_Fetch PLANT      column   3801
Contract_Approval_Fetch USER_ID    column   NEOBMWCONS1   (required)
```

Contract's fields are already `column`, so the user-entered value wins; but Contract still falls back to `NEOBMWCONS1` when USER_ID is blank, which is why the user sees it as "hardcoded".

## Fix (one DB migration, no code changes)

Update `sap_api_request_fields` so user-entered values always take priority:

1. Price_Approval_Fetch · `PLANT`: `source` → `column`, clear `default_value`.
2. Price_Approval_Fetch · `USER_ID`: `source` → `column`, clear `default_value`.
3. Contract_Approval_Fetch · `PLANT`: clear `default_value` (keep `column`).
4. Contract_Approval_Fetch · `USER_ID`: clear `default_value` (keep `column`, still `required = true`).

After the change, `resolveRequestField` for `column` returns `inputs[field_name] ?? default_value`, so whatever the user types in the Plant / USER_ID inputs is sent as `PLANT` and `USER_ID` in the middleware → SAP payload. If the user leaves USER_ID blank, the server function still falls back to the profile's `sap_user_id` before calling the middleware, so behavior for signed-in users is unchanged.

## Verification

- Enter `Plant = 3801`, `USER_ID = SARVI_INFO1` on Price Approvals → server-fn log line `[submitPriceDecision] payload=` and middleware `[raw-invoke]` / SAP request show `PLANT=3801`, `USER_ID=SARVI_INFO1`.
- Repeat on Contract Approvals with a different plant / user — payload reflects the typed values.

## Files touched

- New SQL migration only. No TS/TSX edits.
