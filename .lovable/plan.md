## Diagnosis

The app is not rendering hardcoded dummy rows from the BMW screen. The recent backend logs show SAP/middleware returned those placeholder-looking rows for one request, while another request returned the expected detailed rows.

I found two concrete causes:

1. **Outbound payload mismatch**
   - The BMW API config maps `CONTRACT_FROM` as `static`, so the value entered in the app is dropped before the middleware calls SAP.
   - This can make SAP return broad/multiple placeholder records instead of the same filtered response seen in Postman.

2. **Response key mismatch across modes**
   - Customer-wise responses use keys like `BP_SRV_VALID_FROM`, `BP_NO_BEDS_INVOICE`, `CONTRACT_CREATE_DATE`, `NET_VALUE`, `CON_SRV_VALID_FROM`.
   - Contract/Sales-wise responses use keys like `BP_SERVICE_VALID_FROM`, `BP_NO_BEDS_INV`, `CONTRACT_DATE`, `CONTRACT_NET_VALUE`, `CON_SERVICE_VALID_FRM`.
   - The table currently only supports one variant for several columns, so valid SAP values can render as blanks/`—`.

## Implementation plan

1. **Correct the BMW request mapping**
   - Update the BMW API request-field config so `CONTRACT_FROM` uses the app input value instead of a static blank.
   - Keep `CONTRACT_TO`, customer fields, sales-org fields, and radio flags bound from app inputs.
   - No hardcoded response/data rows will be added.

2. **Make the UI bind actual SAP keys for all three radio modes**
   - Add column key aliases for known SAP response variants, for example:
     - `BP_SERVICE_VALID_FROM` or `BP_SRV_VALID_FROM`
     - `BP_NO_BEDS_INV` or `BP_NO_BEDS_INVOICE`
     - `BP_AGR_FROM` or `BP_AGR_VALID_FROM`
     - `CONTRACT_DATE` or `CONTRACT_CREATE_DATE`
     - `CONTRACT_NET_VALUE` or `NET_VALUE`
     - `CON_SERVICE_VALID_FRM` or `CON_SRV_VALID_FROM`
   - Render the first non-empty matching value from the real API row.

3. **Prevent stale/dummy-looking results from surviving a new search**
   - Clear previous rows when Execute starts.
   - Keep the table populated only from the latest server response.

4. **Preserve all SAP-returned columns**
   - Continue using mode-specific grouped headers for Customer, Contract, and Sales Order.
   - Add a safe fallback for any real response columns not covered by the grouped schema, so newly introduced SAP fields can still be displayed instead of hidden.

5. **Verify against the actual signal**
   - Re-run Customer, Contract, and Sales Order searches.
   - Compare the outgoing request fields and row counts in the sync log with what the table displays.
   - Confirm no hardcoded/mock/dummy data is used anywhere in the BMW report path.