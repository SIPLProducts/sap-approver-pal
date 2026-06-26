## Root cause

The Create User config in SAP API Settings defines its request fields with dotted/array paths:

```
CREATE.USER, CREATE.FIRST_NAME, CREATE.LAST_NAME, CREATE.EMAIL,
CREATE.CONTACT, CREATE.PASSWORD, CREATE.ZCONFPSWD, CREATE.STATUS,
CREATE.PLANTS[].WERKS, CREATE.ROLES[].WERKS, CREATE.ROLES[].ROLE
```

The middleware's `buildRequestPayload` treats every `field_name` as a flat key. It does `payload[f.field_name] = inputs[f.field_name]`. So the body actually POSTed to SAP looks like:

```json
{ "CREATE.USER": null, "CREATE.FIRST_NAME": null, "CREATE.PLANTS[].WERKS": null, ... }
```

There is no `CREATE.USER` nested object in what SAP receives — that is why SAP responds "User is mandatory" even though the UI sent a value. Our server fn also keys its payload as `{ USER, FIRST_NAME, ..., CREATE: { ... } }`, none of which match the configured `field_name`s, so every field resolves to `null`.

## Fix

Two changes, kept narrow to Create User and any other config that uses dotted / `[]` field names.

### 1. `middleware/server.js` — `buildRequestPayload` (and tiny helpers)

Make the builder understand dotted paths and `[]` array segments. Behavior:

- **Flat name** (no `.`, no `[]`) — unchanged: read `inputs[name]`, set `payload[name]`.
- **Dotted scalar** (e.g. `CREATE.USER`) — read `inputs["CREATE.USER"]`, then set nested at path `CREATE.USER` on the outgoing payload.
- **Array leaf** (e.g. `CREATE.PLANTS[].WERKS`) — group all fields sharing the same array root (`CREATE.PLANTS`). Read the input once as `inputs["CREATE.PLANTS"]`, which must be an array of objects. For each entry, project only the configured leaf names (`WERKS`, plus `ROLE` for `CREATE.ROLES[]`) and set the resulting array at the nested array-root path on the payload.

Required validation:
- dotted scalar required and resolved value is null / empty → "Missing required field: CREATE.USER".
- array root with any required leaf and the input array is missing / empty → "Missing required field: CREATE.PLANTS".

Helpers to add:
- `setPath(obj, "A.B.C", value)` — create intermediate objects as needed.
- `splitArrayField(name)` → returns `{ arrayRoot, leaf }` when the name contains `[].`, else `null`.

Resulting body for Create User becomes the exact SAP shape:

```json
{
  "CREATE": {
    "USER": "SURYA001",
    "FIRST_NAME": "SURYA",
    "LAST_NAME": "MAHAPATRA",
    "EMAIL": "...",
    "CONTACT": "9876543210",
    "PASSWORD": "...",
    "ZCONFPSWD": "...",
    "STATUS": "ACTIVE",
    "PLANTS": [{"WERKS": "3801"}, {"WERKS": "3802"}],
    "ROLES":  [{"WERKS": "3801","ROLE":"ADMIN"}, ...]
  }
}
```

Backwards-compat: configs that use flat field names (every existing GET endpoint) keep working unchanged; only field names containing `.` or `[]` go through the new path.

### 2. `src/lib/admin/user-mgmt.functions.ts` — `createUserViaSap`

Replace the `payload` shape so input keys match the configured `field_name`s exactly:

```ts
const payload: Record<string, unknown> = {
  "CREATE.USER":       data.sap_user_id.toUpperCase(),
  "CREATE.FIRST_NAME": data.first_name.toUpperCase(),
  "CREATE.LAST_NAME":  data.last_name.toUpperCase(),
  "CREATE.EMAIL":      data.email,
  "CREATE.CONTACT":    data.contact_number,
  "CREATE.PASSWORD":   data.password,
  "CREATE.ZCONFPSWD":  data.confirm_password,
  "CREATE.STATUS":     data.status === "Active" ? "ACTIVE" : "INACTIVE",
  "CREATE.PLANTS":     uniquePlants.map((p) => ({ WERKS: p })),
  "CREATE.ROLES":      data.roles.map(({ plant, role }) => ({
    WERKS: plant.trim(),
    ROLE:  String(role).trim().toUpperCase(),
  })),
};
```

Audit-log entry still redacts `CREATE.PASSWORD` / `CREATE.ZCONFPSWD`. No other server fn or UI change.

## Out of scope

- Other SAP configs (`*_Approve_Reject`) that also use `DATA[].*` field names — same dotted-name handling will benefit them automatically once the middleware is upgraded, but no caller wiring is changed in this task.
- SAP API Settings UI, Custom Roles flow, plant/role pickers, local DB writes.
- Middleware deployment — the operator needs to redeploy the middleware service for the change to take effect; flagged in the PR notes.
