## Goal
Match the exact Create User SAP payload. The shape is already correct — only the `ROLES` array needs fixing so it reflects the user's per-plant selections instead of a cartesian product.

## Current vs expected

The dialog stores selected roles as composite values `"<plant>::<role>"` (e.g. `3801::ADMIN`, `3801::APPROVER`, `3802::VIEWER`).

- **Current submit** in `CreateUserDialog` (`src/routes/_authenticated/admin.users.tsx`) strips off the plant, dedupes role names, then `createUserViaSap` re-expands every role across every selected plant.
  Result: `3801::ADMIN`, `3802::VIEWER` → sends `ADMIN` and `VIEWER` to **both** 3801 and 3802.
- **Expected** (per provided sample): each composite selection becomes one `ROLES` row with its own `WERKS` + `ROLE`. `PLANTS` stays as the list of distinct selected plants.

All other fields (`USER`, `FIRST_NAME`, `LAST_NAME`, `EMAIL`, `CONTACT`, `PASSWORD`, `ZCONFPSWD`, `STATUS`, `PLANTS[].WERKS`) already match the sample. Response handling (`STATUS=TRUE`, `MESSAGE`, `NUMBER`) already matches.

## Changes

### 1. `src/lib/admin/user-mgmt.functions.ts` — `createUserViaSap`
- Change `roles` input from `string[]` (role names) to `Array<{ plant: string; role: string }>`, min 1, max 200.
- Build `ROLES` directly from that array:
  ```ts
  ROLES: data.roles.map(({ plant, role }) => ({
    WERKS: plant,
    ROLE: String(role).toUpperCase(),
  })),
  ```
- `PLANTS` unchanged (distinct selected plants → `[{ WERKS }]`).
- Drop the cartesian `uniquePlants.flatMap(...)` logic.
- Audit-log payload unchanged in shape (still redacts passwords).

### 2. `src/routes/_authenticated/admin.users.tsx` — `CreateUserDialog.submit`
Replace the current `roles` mapping:
```ts
roles: roles
  .map((v) => {
    const [plant, role] = v.split("::");
    return plant && role ? { plant, role } : null;
  })
  .filter((x): x is { plant: string; role: string } => !!x),
```
No UI changes — the `RoleMultiSelect` already produces these composite values.

### 3. Config lookup (unchanged)
Server fn already resolves the active SAP API config by name (`USER_CREATE` / `Create User` / `CreateUser`) and posts the same `{ ...inner, CREATE: inner }` envelope through the middleware proxy. Response parsing already treats `STATUS=TRUE` as success and surfaces `MESSAGE`.

## Out of scope
- SAP API Settings screen, middleware proxy code, Custom Roles tab.
- Validation rules other than the `roles` shape.
- Local DB writes (this flow is SAP-only; no `profiles`/`user_roles` insert is added).
