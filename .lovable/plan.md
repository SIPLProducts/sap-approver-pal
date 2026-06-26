## Plan

**Goal:** Stop SAP rejecting role creation with `ROLE and ACTIVITY are mandatory`.

**What I found:** The active role-create config fields are named `CREATE.ROLE`, `CREATE.ROLE_DES`, `CREATE.ACTIVITY[].ACTIVITY`, and `CREATE.ACTIVITY[].RELEASE_CODE`. The middleware only reads exact top-level input keys, so it currently builds a broken SAP body with literal dotted keys instead of the nested JSON SAP expects.

**Implementation:**
1. Update `createCustomRoleViaSap` to call the middleware with input keys that exactly match the configured field names:
   - `CREATE.ROLE`
   - `CREATE.ROLE_DES`
   - `CREATE.ACTIVITY[].ACTIVITY`
   - `CREATE.ACTIVITY[].RELEASE_CODE`
2. Update the active role-create API config in the backend so its request field is a single top-level `CREATE` field when needed, allowing the middleware to send this exact payload to SAP:

```json
{
  "CREATE": {
    "ROLE": "APPROVER",
    "ROLE_DES": "Sales Approver",
    "ACTIVITY": [
      { "ACTIVITY": "APPROVE", "RELEASE_CODE": "01" },
      { "ACTIVITY": "REJECT", "RELEASE_CODE": "02" }
    ]
  }
}
```

3. Keep the current SAP error handling so the app shows failure when SAP returns `status: ERROR` instead of showing success.
4. Add/keep audit logging of the exact request and response so we can verify the next SAP call.

**Validation:** Create a role once, then confirm the audit log shows the nested `CREATE` payload and SAP no longer returns mandatory-field error.