## Service Certificate & SO Approvals — live SAP fetch

Replace the current mock-data version of `src/routes/_authenticated/sd.sc-so.tsx` with a live SAP-powered screen, modeled exactly on the working `sd.sales-order.tsx` pattern.

### Selection screen

- **Plant** (mandatory, `*`) — text input
- **User ID** — text input
- **Customer From** — text input
- **Customer To** — text input (falls back to Customer From if empty)
- **Status** radio group: Pending / Accepted / Rejected
- **Approval Type** radio group: Service Certificate Approvals / Sales Order Approvals (single select; default Service Certificate)
- **Execute** button (disabled until Plant filled) + **Reset**

### API call

On Execute (and on status change when Plant is set), call a new server function `fetchScSoApprovals` that POSTs this exact payload to SAP via the existing proxy/direct plumbing:

```json
{
  "PLANT": "3801",
  "CUSTOMER_FROM": "1060016",
  "CUSTOMER_TO": "1060493",
  "USER_ID": "NEOBMWCONS1",
  "R_PEND": "",
  "R_ACCP": "X",
  "R_REJ": "",
  "service": "X",
  "Sales": ""
}
```

- `R_PEND/R_ACCP/R_REJ` flip based on the Status radio (one is `"X"`, others `""`).
- `service`/`Sales` flip based on the Approval Type radio.
- Customer From/To and User ID pass through as entered; empty strings allowed.

### Output

Render returned rows in a table below (columns mirror SAP response: Company Code, Sales Org, Customer, Customer Name, Year, Contract No, Item, Ref No, Ref Date, Creation Date, Contract Start/End, Down Pay Req, Adv. Amount, Net Value, plus Reason for pending). Shows record count, fetched-at timestamp, and toasts API errors with the SAP response text. No Accept/Reject buttons in this first cut — fetch only, matching the requested scope.

### Technical details

- New file `src/lib/sd/sc-so-approval.functions.ts` — copy `fetchSalesOrderApprovals` from `sales-order-approval.functions.ts`, add `approval_type: z.enum(["service","sales"])` to the input, extend `inputs` with `service`/`Sales` flags, use SAP config name `Service_SO_Approval_Fetch` (admin can wire the endpoint in Admin → SAP API).
- Rewrite `src/routes/_authenticated/sd.sc-so.tsx` as a self-contained page (drop the `SdApprovalShell` import) using the same `useMutation`/`useServerFn` pattern as `sd.sales-order.tsx`.
- Status stays in local state only — no URL writes (avoids the 404 navigation issue already fixed on sales-order).

### Out of scope

- Accept/Reject submit flow (can be added in a follow-up once SAP decision endpoint name is known).
- Admin SAP API config row — created by the user in Admin → SAP API with name `Service_SO_Approval_Fetch`.
- No changes to the existing Sales Order Approvals screen.
