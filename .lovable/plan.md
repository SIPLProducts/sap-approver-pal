## Goal
Fix three issues in the Edit dialogs in Admin → Users:
1. **Edit Role** — pre-select the role's currently assigned screens.
2. **Edit User** — show **all** roles assigned to the user (across all plants), not just the first plant's pair.
3. **Edit User** — prefill the Password / Confirm Password fields so they are not empty.

## Findings

- **Edit Role screens not showing:** `CustomRolesTab` has a `handleEdit(r)` helper that fetches `role_permissions` and passes `screen_keys` to `onEditRole`. But the Pencil button at line 588 calls `onEditRole?.(r)` directly, bypassing `handleEdit`. Result: `screen_keys` is always `undefined` and the screen picker is empty.
- **Edit User roles incomplete:** In `CreateUserDialog`'s edit branch (lines 869–873), each role is paired only with `editUser.plants[0]`. So if a user has plants `[P01, P02]` and roles `[R1, R2]`, only `P01::R1`, `P01::R2` are shown. `listUsersViaSap` already deduplicates roles into a flat list and loses the original (plant, role) pairs from the SAP rows.
- **Password prefill:** SAP user-list APIs do not return the stored password (hashed). We can't show the real one. Best practical option: show a masked placeholder/value so the fields look populated; treat unchanged fields as "no password change".

## Changes

### 1. `src/routes/_authenticated/admin.users.tsx` — Edit Role screens
- Change line 588 from `onClick={() => onEditRole?.(r)}` to `onClick={() => handleEdit(r)}` so the role_permissions fetch runs and `screen_keys` is included.

### 2. `src/lib/admin/user-mgmt.functions.ts` — preserve role/plant pairs
- In `listUsersViaSap`, add a new field `role_assignments: { werks: string; role: string }[]` to each user row.
- While iterating SAP rows, capture `(ZWERKS, ZROLE)` pairs and any nested `ROLES[].{WERKS, ROLE}` pairs into a `Set<string>` keyed as `"werks|role"` per user, then expand to objects in the final mapping.
- Keep the existing flat `plants` and `roles` arrays for backwards compatibility.

### 3. `src/routes/_authenticated/admin.users.tsx` — Edit User roles & passwords
In `CreateUserDialog`'s `useEffect` edit branch:
- Replace the "pair role with first plant" logic with:
  - If `editUser.role_assignments` is present and non-empty, map each `{werks, role}` to `"werks::role"`.
  - Else fall back to a Cartesian product: every plant × every role (so all roles appear under every assigned plant).
- For passwords, set both `password` and `confirm_password` to a fixed masked sentinel (e.g. `"********"`).
- Track an `originalPasswordMask` ref/state. On submit in edit mode:
  - If both fields still equal the sentinel, send empty `PASSWORD`/`ZCONFPSWD` (or omit) so SAP doesn't overwrite the password.
  - If the admin changed either field, validate length ≥ 8 and match, then send the new value.
- Loosen the existing `form.password.length < 8` check so it only applies when the password was actually edited.

### 4. Edit User submit path in `editUserViaSap`
- Make `PASSWORD` and `ZCONFPSWD` optional in the input validator; only include them in the SAP payload when non-empty.

## Out of scope
- No DB schema changes.
- No middleware changes.
- No changes to create-user / create-role flows beyond what's needed for shared form state.

## Risks
- If SAP's `Edit_User` rejects requests without `PASSWORD`/`ZCONFPSWD`, we'll need to always resend a value. In that case fallback: re-send the masked sentinel only when the API config marks them required (we already have request-field metadata to check). Will adjust after first live test if needed.
- `role_assignments` extraction depends on the SAP response actually carrying per-row (plant, role) pairs. If the source already dedupes server-side, the Cartesian fallback covers it.
