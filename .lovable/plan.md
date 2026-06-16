## Problem
The Sales Order request reaches the Node middleware now, so the old 404 is fixed. The remaining 502 is because the middleware rebuilds the SAP payload from the database request-field config, and `Sales_Approval_Fetch` is currently configured with all request fields as `static` values:

- `PLANT` static empty
- `CUSTOMER_FROM` static `1060002`
- `CUSTOMER_TO` static `1060493`
- `USER_ID` static empty
- status flags static/defaulted

So the app sends your Postman values to the middleware, but the middleware ignores them and sends the configured static payload to SAP instead. That explains why Postman works while the app/middleware call fails.

## Plan
1. Update the `Sales_Approval_Fetch` request-field configuration in the database so these fields use the incoming app payload:
   - `PLANT` → `column`
   - `CUSTOMER_FROM` → `column`
   - `CUSTOMER_TO` → `column`
   - `USER_ID` → `column`
   - `R_PEND` → `column`
   - `R_ACCP` → `column`
   - `R_REJ` → `column`
2. Clear stale static defaults for Sales Order fetch request fields so blank customer range and user/status values pass through exactly like your working Postman payload.
3. Add targeted middleware logging around named SAP calls so the console prints:
   - resolved config name/id
   - final SAP URL and method
   - outgoing SAP payload
   - upstream SAP status/body preview
4. Improve middleware error response for failed upstream SAP calls so the app shows the real SAP status/body instead of only a generic `502 Bad Gateway`.
5. Keep the frontend payload shape unchanged; your app should continue sending:
   ```json
   {
     "PLANT": "3806",
     "CUSTOMER_FROM": "",
     "CUSTOMER_TO": "",
     "USER_ID": "NEOBMWCONS1",
     "R_PEND": "X",
     "R_ACCP": "",
     "R_REJ": ""
   }
   ```

## Verification
After implementation, restart `middleware/server.js`, click Execute again, and the Node console should show the exact outgoing SAP payload matching the Postman payload.