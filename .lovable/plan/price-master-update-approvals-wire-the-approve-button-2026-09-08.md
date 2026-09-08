# Price Master Update Approvals — wire the Approve button

When rows are loaded on the Price Master Update Approvals screen, ticking one or more rows and clicking **Approve** will call the SAP service configured as `PMUA_APPROVE_API` and show the exact `MESSAGE` from the response in the standard popup.

## Behaviour

- Approve stays disabled until at least one row is ticked (unchanged).
- On click, the selected rows are sent in one call, exactly as they came back from SAP:

```text
{ "Approve": [ { ...selected row fields as received... } ] }
```

- Fields are forwarded verbatim (WERKS, KUNNR, ZCUST_NAME, WST_TYPE, MATNR, PRICE, flags, dates, TON columns, USER_ID1/2, UPDATE2, UPTIME, STATUS_P, STATUS, etc.). No reformatting, no derived values.
- Button shows a loading state while the call runs.
- Response `[{ "TYPE": "S", "MESSAGE": "Approved Sucessfully" }]` → the exact `MESSAGE` text appears in the same SweetAlert popup used on the other screens; success styling for `TYPE` S, error styling for E/A or `STATUS` FALSE.
- After a successful approval the approved rows are cleared from the list and the selection is reset, so Execute must be pressed again to see the refreshed state.
- Network or configuration problems surface the exact SAP text when available, otherwise a plain message.

## What stays the same

Fetch flow, filters, radio group, Reset, columns, table design, Reject button (still a pending note), permissions, sidebar and every other screen or SAP function are untouched.

## Technical notes

- New server fn in `src/lib/imw/price-master-approvals.functions.ts`: `approvePriceMasterApprovals` (`createServerFn({ method: "POST" })` + `requireSupabaseAuth`), structured exactly like the existing `fetchPriceMasterApprovals` — same `sap_api_configs` lookup (name `PMUA_APPROVE_API`), credentials/global-settings/proxy-secret resolution, proxy vs direct target, `sap_api_sync_log` write, `extractSapMsg` reuse.
- Zod input: `rows: z.array(z.record(z.any())).min(1)`; body `{ Approve: data.rows }`.
- Return `{ ok: boolean; message: string | null }` — `ok` from `TYPE === "S"` (and not `STATUS: "FALSE"`), `message` from `MESSAGE`/`MSG`/`MSGTXT` of the first node.
- `src/routes/_authenticated/imw.price-master-approvals.tsx`: add `useServerFn` + `useMutation` for the approve fn, replace the Approve `onClick` toast with `approveMutation.mutate({ rows: selectedRows })` where `selectedRows` maps `selected` keys (row index) back to `rows`; on success `setSapDialog({ open: true, title: "Price Master Approve Response", refLabel: "Message", results: [{ ref: "", message, ok }] })`, drop approved rows and clear selection when `ok`.
