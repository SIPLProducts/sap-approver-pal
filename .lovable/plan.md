# Material Reservation — show exact Save error message

## Verified cause
- SAP returns the expected payload: `MESSAGES: [{ TYPE: "E", MESSAGE: "..." }]`.
- Material Reservation currently calls the middleware’s normal mapped `/sap/invoke` mode.
- `Material_Save_API` is configured with top-level response fields (`TYPE`, `DOCUMENT_NUMBER`, `MESSAGE`). The middleware mapper does not preserve the nested `MESSAGES` array, so it converts this SAP response into empty/undefined mapped fields before the app receives it.
- The existing Material Reservation parser can already extract the exact error correctly, but it never receives the original `MESSAGES` payload.

## Change
- Request the raw SAP response only for the Material Reservation Save call by adding the middleware’s existing `raw: true` option.
- Keep the current recursive `MESSAGES` parsing and SweetAlert flow unchanged.
- Add a regression test using the exact response:
  `{"MESSAGES":[{"TYPE":"E","MESSAGE":"Requested quantity should be lessthan or equal to total stock"}]}`
- Verify the result is `ok: false` and the popup message is exactly:
  `Requested quantity should be lessthan or equal to total stock`

## Unchanged
- Save request payload and SAP endpoint
- Fetch flow, row selection, HOD approval/rejection behavior
- Success handling and list refresh
- Other MM screens and middleware response mapping

## Deployment note
The application must be redeployed after this change; no middleware redeployment is required because `raw` mode already exists.
