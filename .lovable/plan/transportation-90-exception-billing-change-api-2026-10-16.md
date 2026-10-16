# Transportation (90%) Exception Billing: Change API

## What changes

1. **Change calls `90%_Change_API`** (from SAP API Settings) with one entry per ticked row:
```text
{ "modify": [ { "user_name": <signed-in SAP user>, "werks": WERKS, "KUNNR": KUNNR,
                "NAME1": NAME1, "CHK_VALUE": "X" or " ", "remark": entered Remarks } ] }
```
   Values come from the current row, including edits to Customer, Customer Name, Check Value and Remarks. Unchecked Check Value is sent as a single space, matching the sample.
2. **Popup** — exact SAP `MESSAGE` in the existing SweetAlert: success style for `TYPE` "S", error style for "E".
3. **Refresh** — only when every returned entry is "S", Execute reruns to reload the table. On error the table stays as is.
4. Change shows "Changing…" while running; Save/Change/Delete stay disabled meanwhile and until a row is ticked (unchanged rule).

Nothing else changes: Save, Delete (still display-only), Plant F4, Execute, columns, layout.

## Technical details

- `src/lib/sap/customer.functions.ts`: add `getTransportChangeConfig` (same as `getTransportSaveConfig`, looking up `90%_Change_API` case-insensitively, returning `configId` + `userName`).
- `imw.transportation-exception-billing.tsx`: generalize the Save handler into a shared submit helper (key `save`/`modify`, config getter, unchecked value), reusing the same response parsing, `swalSapResponse`, and `execute()` refresh. Wire Change `onClick`.
- Verify with typecheck and preview build.
