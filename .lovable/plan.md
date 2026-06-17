## Show SAP response in result dialog on Sales Order Approvals (Approve / Reject)

The Sales Order Approvals screen already calls the `Sales_Order_Approve_Reject` SAP API and has a result dialog identical to the Contract Approvals screen. The dialog isn't appearing because two edge-case paths short-circuit it:

1. When SAP returns a non-2xx (server treats it as `ok: false`) but the body still contains a valid `MESSAGE` array (e.g. the success payload you pasted), the client currently shows a toast only and never opens the dialog.
2. The middleware can return the SAP body under different wrappers (`sap_response`, `sap_response.data`, `sap_response.data.MESSAGE`, or a stringified `data`), and the current extraction misses some shapes — leaving `messages = []` so the dialog opens but is blank.

### Changes — `src/routes/_authenticated/sd.sales-order.tsx` only

Update only the `decisionMutation.onSuccess` block (around lines 218–253). No backend / server-function / payload changes.

1. **Robust message extraction** — mirror the working contract logic but add fallbacks:
   - Accept `sap_response`, `sap_response.data` (object or JSON string), and `debug.response_body_preview` as JSON fallback.
   - Look for `MESSAGE`, `message`, `Messages`, or `MSG` arrays at either level.
   - Normalize a single object into a one-element array.

2. **Always open the dialog when SAP returned a body** — even if `ok === false`, if we successfully parsed any `MESSAGE` entries, open the result dialog (which already classifies by `TYPE` — `@01@` ⇒ success, `E` ⇒ error, etc.) instead of only showing a toast. Keep the toast fallback for true network/transport failures with no body.

3. **On success with no parsable messages**, show a generic success entry in the dialog (`{ TYPE: "@01@", MSG: "Submitted to SAP" }`) so the user always sees a confirmation modal, matching the behavior the user expects from Contract Approvals.

### Verification

Open Sales Order Approvals → select a row → enter a reason → click Approve. With the sample SAP response:
```json
{ "MESSAGE": [{ "COMP_CODE":"3111", "CUSTOMER":"1060191", "CONTRACT":"1000500031", "TYPE":"@01@", "MSG":"Sales Order Released Successfully-1000500031" }] }
```
the result dialog should show a green "Approved successfully" banner with one row: `S | 1060191 | 1000500031 | Sales Order Released Successfully-1000500031`. Repeat for Reject. Confirm the pending list refreshes and selections clear, exactly like Contract Approvals.