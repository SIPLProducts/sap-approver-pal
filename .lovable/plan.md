# Why SAP still says "ROLE and ACTIVITY are mandatory"

The middleware does NOT forward our payload verbatim. In `middleware/server.js → invokeSap` it builds the SAP request from `cfg.requestFields` (per-config field mapping), reading values out of `inputs` by `field_name` (or via `${input.X}` expressions). It then sends `{ field_name: value, ... }` to SAP.

Today the app calls the middleware with:

```
inputs = { CREATE: { ROLE, ROLE_DES, ACTIVITY: [...] } }
```

So `inputs.ROLE`, `inputs.ROLE_DES`, and `inputs.ACTIVITY` are all undefined. If the SAP API Settings → `ROLE_CREATE` config has request fields named `ROLE` / `ROLE_DES` / `ACTIVITY` (column source) — which it almost certainly does, given the SAP error — they all resolve to empty and SAP rejects with `"ROLE and ACTIVITY are mandatory"`.

`createUserViaSap` likely "works" only because its `USER_CREATE` config either has a single column field named `CREATE`, or different field names that happen to read from the wrapper. We shouldn't depend on that.

# Fix (frontend/server-fn only, no middleware or DB changes)

In `src/lib/admin/user-mgmt.functions.ts → createCustomRoleViaSap`, send the inputs in BOTH shapes so the middleware's field mapping picks them up no matter how `ROLE_CREATE.requestFields` is configured:

```ts
const inner = {
  ROLE: data.name.toUpperCase(),
  ROLE_DES: data.description || "",
  ACTIVITY: uniqueScreens.map((k) => ({
    ACTIVITY: k.toUpperCase(),
    RELEASE_CODE: k,
  })),
};
const payload = {
  // Flat top-level — used when config fields are named ROLE / ROLE_DES / ACTIVITY
  ROLE: inner.ROLE,
  ROLE_DES: inner.ROLE_DES,
  ACTIVITY: inner.ACTIVITY,
  // Wrapped — used when config has a single column field named CREATE
  CREATE: inner,
};
```

Apply the same dual-shape pattern to `createUserViaSap` so it doesn't silently rely on the wrapper either:

```ts
const inner = { USER: ..., FIRST_NAME: ..., /* ... */ ROLES: [...] };
const payload = { ...inner, CREATE: inner };
```

The existing case-insensitive status / message / number response handling (`pickField`, `isExplicitError`, `isExplicitSuccess`) stays as-is and continues to surface real SAP errors instead of false-success toasts.

# Out of scope

- No changes to `middleware/server.js`, no changes to `sap_api_configs` rows, no schema/UI changes.
- No changes to `listRolesForPlants` (separate `ROLE_LIST` config, already works).

# Verification

1. Open Admin → Users & Roles → Add New Role, fill RESL_ADMIN with screens, Save.
2. Expect a real success toast and a new row in `custom_roles` + `role_permissions`.
3. If SAP still rejects, the audit row in `admin_audit_log` (`action = user.sap_role_create`) will show the full request/response — share that and we'll adjust the field names to match the actual `ROLE_CREATE` config.
