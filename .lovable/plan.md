## Goal

Wire Accept / Reject buttons on the **Service Certificate & SO Approvals** screen (`/sd/sc-so`) to call the SAP API config **`Service_Certificate_Approve_Reject`**, then show the same SAP-response dialog used by the Sales Order Approvals screen.

## Backend — `src/lib/sd/sc-so-approval.functions.ts`

Add a new server function `submitScSoDecision` (mirrors `submitSalesOrderDecision`):

- Auth: `requireSupabaseAuth`.
- Input: `{ action: "accepted" | "rejected", user_id?: string, approval_type: "service" | "sales", rows: ScSoRow[] }`.
- Reads config row `name = "Service_Certificate_Approve_Reject"` from `sap_api_configs` (plus credentials, global settings, global secret). Errors if missing or `is_active = false`.
- Resolves `USER_ID` from (in order): explicit `user_id` → `profiles.sap_user_id` for the caller → SAP API request-field default → fallback `"NEOBMWCONS"`.
- Builds payload exactly in the SAP-expected shape:

```json
{
  "APPROV": "X" | "",
  "REJ":    "X" | "",
  "USER_ID": "...",
  "DATA": [
    {
      "SELECT": "X",
      "COMPANY_CODE": "...", "SALES_ORG": "...", "CUSTOMER": "...", "CUSTOMER_NAME": "...",
      "YEAR": <number-or-string>, "CONTRACT_NO": "...", "CONTRACT_ITEM": <num>,
      "CONTRACT_REF_NO": "...", "CONTRACT_REF_DATE": "...",
      "CON_CREATION_DATE": "...", "CONTRACT_START_DATE": "...", "CONTRACT_END_DATE": "...",
      "DOWN_PAY_REQ_AMOUNT": <num>,
      "ADV_DOC_NUM": { "ZEILE": <num|"">, "EBELP": <num|""> },
      "ADV_AMOUNT": <num>, "PROFIT_CENTER": "", "CLEARING_DOCUMENT": "",
      "CUSTOMER_GROUP": "...", "CUSTOMER_PRICE_GROUP": "...",
      "SERVICE_VALID_FROM": "...", "SERVICE_VALID_TO": "...",
      "SERVICE_START_DATE": "...", "REGISTRATION_DATE": "...",
      "CUS_AGR_FROM": "...", "CUS_AGR_TO": "...",
      "ACTIVE_INACTIVE": "...", "NO_OF_BEDS_TO_BE_INV": <num>,
      "FIXED_RATE": <num>, "PER_BED_RATE": <num>, "EXCESS_QTY_RATE": <num>,
      "UPPER_SLAB_QTY": <num>, "CODE_LAND_QTY": <num>, "TOTAL_BALANCE": <num>,
      "PH_REASON_CODE": "...", "REASON": "<user reason>"
    }
  ]
}
```

Numeric fields are emitted as numbers when the source value is numeric, empty string otherwise (matches the sample where `ZEILE`/`EBELP` are left blank). `CUSTOMER` is left-padded to 10 digits when fully numeric (same helper as Sales Order).

- Proxy / direct dispatch and headers follow the same pattern as `submitSalesOrderDecision`:
  - Proxy URL: `${middlewareUrl}/service_certificate/Service_Certificate_Approve_Reject` with `{ inputs: sapPayload }`; fallback to `/sap/invoke` on a "Cannot POST/PUT" 404 from the proxy.
  - Direct: POST `cfg.endpoint_url` with `sapPayload`; Basic auth when configured.
- Logs every attempt into `sap_api_sync_log` (`ok` / `error`).
- Returns `{ ok, action, count, error, sap_response, debug }` in the same shape as the Sales Order decision fn so the existing dialog parser can reuse it. No DB schema changes.

The `approval_type` field is accepted for future routing but currently sends to the same `Service_Certificate_Approve_Reject` config (user only mentioned this one API). If a separate Sales-Order variant is needed later it can be added without UI changes.

## Frontend — `src/routes/_authenticated/sd.sc-so.tsx`

Mirror the Sales Order screen's submit + dialog flow:

1. Import `Dialog*`, `Check`, `X`, `CheckCircle2`, `XCircle`, `AlertTriangle` and the new `submitScSoDecision` server fn; add `useServerFn` for it.
2. Add `decisionMutation` (React Query) calling `submitScSoDecision({ data: { action, user_id, approval_type, rows } })`. On success: open the result dialog, clear selection/reasons, and refetch with `status="pending"`. On error: toast.
3. Add Accept / Reject buttons in the output header (visible only when `status === "pending"`), disabled unless ≥1 row is selected, all selected rows have a non-empty reason, and the mutation isn't pending. Same green Accept / destructive Reject styling as Sales Order.
4. Selected rows are mapped from `ScSoRow` (already in state) and passed in with `reason` taken from the `reasons` map.
5. Add the same `ResultDialog` component (copy verbatim from `sd.sales-order.tsx`) showing the banner ("Approved successfully" / "Rejected successfully" / "Completed with errors/warnings") and per-message details. Severity mapping handles `TYPE: "S" | "E" | "W" | "I"` so the sample `{"MESSAGE":[{"TYPE":"S","MSG":"Mail Sent Successfully"}]}` renders as a success banner with the message listed.
6. Reason input is already in the row; reuse the existing `missingReason` check (already present in the Sales Order screen, port the same `useMemo`).

No other screens are touched.

## Out of scope

- No changes to Price / Contract / Sales Order screens.
- No DB migrations — the SAP API config row `Service_Certificate_Approve_Reject` must already exist (the user confirmed it's configured in Admin → SAP API).
