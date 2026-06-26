## Plan

I found the latest audit entry is still sending flattened dotted keys to the middleware input:

```json
{
  "CREATE.USER": "SARVI_INFO1",
  "CREATE.FIRST_NAME": "PRADEEP",
  "CREATE.PLANTS": [{ "WERKS": "3801" }],
  "CREATE.ROLES": [{ "WERKS": "3801", "ROLE": "ADMIN" }]
}
```

The middleware can translate that into nested SAP JSON, but if the deployed/running middleware is stale or not using the new builder, SAP still receives the wrong shape and reports `User is mandatory`.

### Changes to implement

1. **Send the required SAP payload directly from the app**
   - Update `createUserViaSap` so it passes exactly:

```json
{
  "CREATE": {
    "USER": "...",
    "FIRST_NAME": "...",
    "LAST_NAME": "...",
    "EMAIL": "...",
    "CONTACT": "...",
    "PASSWORD": "...",
    "ZCONFPSWD": "...",
    "STATUS": "ACTIVE",
    "PLANTS": [{ "WERKS": "3801" }],
    "ROLES": [{ "WERKS": "3801", "ROLE": "ADMIN" }]
  }
}
```

2. **Make middleware accept direct nested objects**
   - Update `buildRequestPayload` so when it sees configured fields like `CREATE.USER`, it first reads from nested `inputs.CREATE.USER` before falling back to flat `inputs["CREATE.USER"]`.
   - For array roots like `CREATE.PLANTS[]`, it first reads `inputs.CREATE.PLANTS` before falling back to `inputs["CREATE.PLANTS"]`.

3. **Improve middleware logs for verification**
   - Add a log line for the final outbound SAP request payload, with password fields redacted, so the next `/sap/invoke` log proves the actual body matches SAP’s required payload.

4. **Keep UI role mapping unchanged**
   - The Create User dialog already maps selected plant-role values into `{ plant, role }`, so no UI changes are needed.

### Validation

- Re-check the latest audit request after submission to confirm it stores nested `CREATE` instead of flat `CREATE.USER` keys.
- The middleware log should show the outbound payload with `CREATE.USER` nested inside `CREATE`.