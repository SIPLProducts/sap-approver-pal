# Transportation (90%) Exception Billing – connect Delete

## What changes
- Clicking Delete (New Record unticked) sends all ticked rows to `90%_Delete_API` (from SAP API Settings) in one request.
- Payload: `{ delete: [{ user_name, werks, KUNNR, NAME1, CHK_VALUE: "X", remark }] }` — logged-in SAP user ID, latest row values, CHK_VALUE always "X".
- Popup shows only SAP's MESSAGE (green for S, red for E); table reloads after success. Button shows "Deleting…" while running. No confirmation step (same as Distance Master / Vehicle Master).

## Technical details
- `src/lib/sap/customer.functions.ts`: add `getTransportDeleteConfig` (looks up `90%_Delete_API`, returns configId + userName), same shape as `getTransportChangeConfig`.
- `imw.transportation-exception-billing.tsx`: add `deleting` state (included in `busy`); extend `submit` to accept `"delete"` mode using the delete config, key `delete`, CHK_VALUE forced to "X", title "Deleted"; wire `onClick={remove}` on the Delete button.
- Save and Change behaviour unchanged.
