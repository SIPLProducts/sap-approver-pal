Update Sales Order Approvals fetch payload in `src/lib/sd/sales-order-approval.functions.ts` to the new structure:

- Change `CUSTOMER_FROM`/`CUSTOMER_TO` to a single `CUSTOMER` field, populated from the existing Customer selection.
- Change `SEARCH_TERMS` to an empty array `[]`.
- Remove the `SORTL` field.
- Keep `PLANT`, `USER_ID`, `R_PEND`, `R_ACCP`, and `R_REJ` exactly as currently derived.

Also update the direct-SAP query-string fallback (if triggered) and the proxy 404 fallback so they remain consistent with the new payload shape. All other code, UI behavior, validation, mapping, and decision submission logic remains untouched.
