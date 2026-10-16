# Transportation (90%) Exception Billing: Save API + button enabling

## What changes

1. **Buttons enabled only with a selection** — Save, Change and Delete are disabled until at least one row checkbox is ticked. Change and Delete stay display-only (no API given yet).
2. **Save calls `90%_Save_API`** (from SAP API Settings) with one entry per selected row:
```text
{ "save": [ { "user_name": <logged-in SAP user>, "werks": WERKS, "KUNNR": KUNNR,
              "NAME1": NAME1, "CHK_VALUE": "X" or "", "remark": entered Remarks } ] }
```
   Values come from the current row, including any edits to Customer, Customer Name, Check Value and Remarks. `user_name` is the signed-in user's SAP ID, filled in automatically.
3. **Response popup** — the exact `MESSAGE` from SAP is shown in the existing brand SweetAlert: success style when `TYPE` is "S", error style when "E" (one line per returned message if several rows).
4. **Refresh** — only when every returned entry is `TYPE` "S", the existing Execute call reruns with the same plants to reload the table. On any error, the table is left as is.
5. Save shows a loading state while running so it can't be double-clicked.

Nothing else changes: Plant F4, Execute payload, columns, row editors, layout.

## Technical details

- `src/lib/sap/customer.functions.ts`: add `saveTransportBilling` server fn (auth middleware) — looks up active `90%_Save_API` (case-insensitive), resolves `user_name` from `profiles.sap_user_id` like Price Master Approvals, builds the `save` array from the rows passed in, calls SAP through the same shared path as `runSapApi`, and returns `{ ok, results: [{ type, message }] }` using the existing exact-message extraction (`src/lib/mm/sap-message.ts`) as fallback for non-array/error responses.
- `imw.transportation-exception-billing.tsx`: `disabled={selectedRowKeys.size === 0 || saving}` on all three buttons; Save handler sends selected rows, shows `swalSapResponse` (ok per TYPE === "S"), then calls `execute()`-equivalent with the last executed plants on full success.
- Verify with typecheck and the preview build.
