# Price Master Update Approvals — Reject action + editable Price Remarks

Two additions to the Price Master Update Approvals screen. Nothing else on the screen changes.

## 1. Reject button

- Reject stays disabled until at least one row is ticked (unchanged).
- On click, the ticked rows are sent in one call to the SAP service configured as `PMUA_REJECT_API`:

```text
{ "reject": [ { ...selected row fields as received... } ] }
```

- Fields are forwarded verbatim (WERKS, KUNNR, ZCUST_NAME, WST_TYPE, MATNR, PRICE, flags, dates, TON columns, USER_ID1/2, UPDATE2, UPTIME, STATUS_P, STATUS, etc.), with `PRICE_REMARKS` carrying whatever the user typed in the remarks box for that row (otherwise the value as received).
- Button shows a loading state while the call runs.
- Response `[{ "TYPE": "S", "MESSAGE": "Rejected Sucessfully" }]` → the exact `MESSAGE` text appears in the same popup used by Approve; success styling for `TYPE` S, error styling for E/A or `STATUS` FALSE.
- After a successful rejection the rejected rows are removed from the list and the selection is cleared.
- Network or configuration problems show the exact SAP text when available, otherwise a plain message.

## 2. Price Remarks as an input

- When the **Pending** radio is selected, the Price Remarks column renders an editable text box using exactly the same design as the Price Master Update screen.
- For Approved and Rejected, Price Remarks stays plain read-only text as today.
- Typed remarks are included in both the Approve and Reject payloads for that row.

## What stays the same

Fetch flow, filters, radio group, Reset, columns, table design, Approve wiring, permissions, sidebar and every other screen or SAP function are untouched.

## Technical notes

- `src/lib/imw/price-master-approvals.functions.ts`: add `rejectPriceMasterApprovals` (`createServerFn({ method: "POST" })` + `requireSupabaseAuth`), structured identically to `approvePriceMasterApprovals` — same `sap_api_configs` lookup (name `PMUA_REJECT_API`), credentials/global-settings/proxy-secret resolution, proxy vs direct target, `sap_api_sync_log` write (`pmua-reject:` prefix), `extractSapMsg` reuse. Input `rows: z.array(z.record(z.string(), z.any())).min(1)`; body `{ reject: data.rows }`; returns `{ ok, message }`.
- `src/routes/_authenticated/imw.price-master-approvals.tsx`:
  - add `edits` state `Record<string, { PRICE_REMARKS?: string }>` and a cell renderer for `PRICE_REMARKS` that returns the same compact `Input` used in `imw.price-master.tsx` when `status === "pending"`.
  - add a `withEdits(picked)` helper that merges typed remarks into the row objects; use it in both `onApprove` and the new `onReject`.
  - add `useServerFn` + `useMutation` for the reject fn; replace the Reject `onClick` toast with `rejectMutation.mutate({ rows })`, `disabled={selected.size === 0 || rejectMutation.isPending}`, label `Rejecting…` while pending; on success open `setSapDialog({ title: "Price Master Reject Response", refLabel: "Message", results: [{ ref: "", message, ok }] })`, drop rejected rows and clear selection when `ok`.
  - clear `edits` wherever `selected`/`rows` are reset (fetch success, reset, clearResults).
- Verify with `bunx tsgo --noEmit -p tsconfig.json`.
