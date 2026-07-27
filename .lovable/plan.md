## Problem

In the Edit User popup, the Roles multi-select never shows the user's currently assigned roles. The list of dropdown options is built from active `custom_roles` (case-preserved, e.g. `3801::Admin`), but the prefill logic uppercases the incoming role names from SAP (`3801::ADMIN`). A subsequent effect prunes any selected value that isn't in the options list, so every pre-selected role is silently dropped. In addition, if `custom_roles` hasn't finished loading when `editUser` is set, the same pruner wipes the selection before options exist.

## Fix (frontend only, `src/routes/_authenticated/admin.users.tsx`)

1. Prefill effect that reacts to `editUser`
   - Also depend on `customRoles` (and its loading state) so the effect re-runs once roles are available.
   - Build a case-insensitive lookup: `roleByUpper = Map<UPPERCASE(name), canonicalName>` from `customRoles`.
   - For each entry in `editUser.role_assignments` (and the `roles`-only fallback), resolve the role via `roleByUpper` and emit the composite as `${werks}::${canonicalName}` (matching option values exactly). If the role can't be resolved yet (roles still loading) leave the pre-selected raw value untouched so the pruner won't yet run against it.
   - Keep plants/status/password behaviour unchanged.

2. Pruner effect (drops selections not in `roleOptions`)
   - Wait until `customRoles` has loaded (`!rolesQuery.isLoading && customRoles.length >= 0`) before pruning, so the initial prefill isn't cleared during the first render.
   - Compare case-insensitively: split the composite into `plant::role`, and keep the value if there exists an option with the same plant and a role name whose uppercase matches — replacing the stored value with the option's canonical composite so subsequent renders match exactly.

3. No changes to server functions, payload shape, save flow, password/change-password logic, or the create-user path. Custom Roles tab and permissions logic are untouched.

## Verification

- Open Edit User for a SAP-synced user with assigned roles: the Roles field renders chips for each `plant - role` from `role_assignments`, matching casing from `custom_roles`.
- Change something unrelated (e.g. first name) and Save: outgoing payload's `roles` array is identical to what was preloaded (verified via network tab), so no roles are lost.
- Open a user with no assignments: field remains empty, "No custom roles configured" behaviour unchanged.
- Create User (no `editUser`): starts empty, unaffected.