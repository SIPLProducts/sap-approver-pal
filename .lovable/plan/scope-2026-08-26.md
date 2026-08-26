Update fetch payloads for Contract Approvals and Service Certificate & SO Approvals to the new SAP structure.

## Scope
Only the SAP fetch payloads are changing. UI, validation, row mapping, and approval-submit logic stay untouched.

## Contract Approvals — `src/lib/sd/contract-approval.functions.ts`
Inside `fetchContractApprovals`:
- Replace `CUSTOMER_FROM` / `CUSTOMER_TO` with a single `CUSTOMER` field set to the existing customer selection (`customer_from`, trimmed).
- Set `SEARCH_TERMS` to `[]`.
- Set `SORTL` to `""`.
- Keep `PLANT`, `USER_ID`, `R_PEND`, `R_ACCP`, and `R_REJ` exactly as currently derived.
- Update the direct-SAP GET query-string fallback so it sends `CUSTOMER` only and drops `CUSTOMER_TO`, `SORTL`, and `SEARCH_TERMS`.
- Update the proxy 404 fallback body (`/sap/invoke`) so it uses the new `inputs` shape.

## Service Certificate & SO Approvals — `src/lib/sd/sc-so-approval.functions.ts`
Inside `fetchScSoApprovals`:
- Replace `CUSTOMER_FROM` / `CUSTOMER_TO` with a single `CUSTOMER` field set to the existing customer selection.
- Set `SEARCH_TERMS` to `[]`.
- Set `SORTL` to `""`.
- Keep `PLANT`, `USER_ID`, `R_PEND`, `R_ACCP`, and `R_REJ` exactly as currently derived.
- Keep the existing `service` / `Sales` flags (e.g. `service: "X"` for Service Certificate, `Sales: "X"` for Sales Order).
- The direct JSON body path will automatically use the updated `inputs` object.

## Out of scope
- `src/lib/sd/sales-order-approval.functions.ts` already matches the requested payload shape, so no changes are needed there.
- No route, component, table, or approval-submit logic changes.
