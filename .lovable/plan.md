## Sales Order Approvals — mirror Contract Approvals

Rebuild `src/routes/_authenticated/sd.sales-order.tsx` and add a new server-functions module so the SO screen behaves identically to Contract Approvals: same selection screen, live SAP fetch on Execute, table of fetched rows, Accept/Reject with reasons, and the SAP message result dialog.

### 1. New file: `src/lib/sd/sales-order-approval.functions.ts`

Mirrors `contract-approval.functions.ts` but tailored to the SO response shape.

- `SalesOrderRow` type with fields from the sample:
  `select, company_code, sales_org, dis_chanel, division, customer, customer_name, customer_group, customer_price_group, year, contract_no, contract_item, sales_document_no, so_creation_date, sales_item_no, material, qty, net_value, tax_value, reason`.
- `fetchSalesOrderApprovals` — uses SAP API config `Sales_Approval_Fetch`. Same inputs as contract (`PLANT`, `CUSTOMER_FROM`, `CUSTOMER_TO`, `USER_ID`, `R_PEND`, `R_ACCP`, `R_REJ`). Same proxy/direct branching. Proxy path: `${middleware}/sales_order_approval/Fetch` with `/sap/invoke` fallback on 404. Parses `DATA[]` from the response.
- `submitSalesOrderDecision` — uses SAP API config `Sales_Approve_Reject`. Builds the same envelope `{ USER_ID, APPROV, REJ, DATA: [...] }` mapping each row back to UPPERCASE SAP keys (`SELECT:"X"`, `SALES_DOCUMENT_NO`, `SALES_ITEM_NO`, etc.). Proxy path: `${middleware}/sales_order_approval/Sales_Approve_Reject` with `/sap/invoke` fallback. Returns `{ ok, sap_response, debug }` exactly like contract submit so the same result-dialog logic works.

### 2. Rewrite `src/routes/_authenticated/sd.sales-order.tsx`

Replace the current `SdApprovalShell`-based page with a self-contained page modeled on `sd.contract.tsx`:

- Header: "Sales Order Approvals" + badges (`ZBMW_SO_APP`, `Single level`).
- Selection screen: Plant* / User ID / Customer From / Customer To / Execute / Reset.
- Status radios: Pending / Accepted / Rejected (drives `R_PEND/R_ACCP/R_REJ`, re-fetches on change).
- Table columns: Customer, Customer Name, Year, Contract No, Contract Item, SO Doc No, SO Item, SO Creation Date, Material, Qty (right), Net Value (right), Tax Value (right), Total = Net+Tax (right, computed client-side), Sales Org, Co. Code, Dis. Chanel, Division, Cust Grp, Price Grp, Reason (input when pending).
- Selection: checkbox column + select-all when status=pending. Accept/Reject buttons require reason on every selected row.
- Result dialog: reuses Contract's `SapMsg`/`mapSeverity`/`SEV_LABEL`/`SEV_CLASS` shape — flat list with Type badge, Customer, Contract, MSG, plus a counts banner. Refreshes pending list on success.
- Same `useMutation` + `useServerFn` wiring, same console grouping of `debug` payload, same toast messages.

### 3. Search params

Keep `status` in the route search (validated via `zod`) so deep links still work, and seed `useState` from `Route.useSearch()`; update the URL on radio change like the existing file does.

### 4. Not changed

- `SdApprovalShell` stays in place (Price screen still uses it).
- No DB / middleware / schema changes — assumes admin has already created `Sales_Approval_Fetch` and `Sales_Approve_Reject` rows in `sap_api_configs` (same as the contract configs).

### Technical notes

- File length will be close to `sd.contract.tsx` (~600 lines) — most logic is duplicated 1:1 and only column rendering + the row-mapping helpers change.
- Reused helpers (`fmtNum`, `fmtDate`, `mapSeverity`, `SEV_*`) are copied locally rather than extracted, to keep this change scoped to two files.
