## Goal
Restructure the Sales Order Approvals output table columns to match this exact order:

SELECT, CUSTOMER, CUSTOMER_NAME, CUSTOMER_GROUP, CUSTOMER_PRICE_GROUP, MATERIAL, QTY, NET_VALUE, CONTRACT_NO, SALES_DOCUMENT_NO, SO_CREATION_DATE, SALES_ITEM_NO, CONTRACT_ITEM, DIS_CHANEL, DIVISION, YEAR, SALES_ORG, COMPANY_CODE, TAX_VALUE, REASON

## Changes
File: `src/routes/_authenticated/sd.sales-order.tsx`

1. **Table headers (`<thead>`):** Reorder `<th>` elements to match the sequence above.
   - Split combined columns into separate columns:
     - "DC / Div" → separate `DIS_CHANEL` and `DIVISION` columns
     - "Cust Grp / Price" → separate `CUSTOMER_GROUP` and `CUSTOMER_PRICE_GROUP` columns
   - Remove the "Total" column (Net Value + Tax Value calculated field).
   - `SELECT` maps to the existing checkbox column (shown only for Pending).

2. **Table body (`<tbody>`):** Reorder `<td>` elements in each row to match the new header sequence, using the same field accessors (`r.customer`, `r.customer_group`, `r.dis_chanel`, etc.).

3. **Column count constants:** Update `baseCols` from 19 to 20 (`#` + 19 data columns) so `colSpan` on empty/loading states remains correct.

## No backend changes required
All fields (`customer_group`, `customer_price_group`, `dis_chanel`, `division`, `sales_org`, `company_code`, etc.) are already defined in the `SalesOrderRow` type and populated by the existing `fetchSalesOrderApprovals` server function.