## Plan

**Goal:** Remove the built-in roles list ("dummy" roles like Admin, F1, F2, M1, etc.) from the Role Permissions screen so only real custom roles created via SAP are selectable.

**Changes to `src/routes/_authenticated/admin.users.tsx` → `PermissionsTab`:**

1. Drop the `builtin:` branch entirely from the role selector:
   - Remove the "Built-in roles" group label and the `ALL_ROLES.map(...)` `<SelectItem>` block.
   - Keep only the custom roles listed (no "Custom roles" header needed since it's the only group).
2. Default `target` to the first available custom role instead of `"builtin:Admin"`. Show an empty state in the matrix when no custom roles exist ("Create a custom role first").
3. Simplify the permission query and `toggle()` to always use `custom_role_id` (remove the `built_in_role` branches in this component only).
4. Leave `ALL_ROLES` / `ROLE_LABELS` imports untouched if still used elsewhere in the file (they are — assignment dropdowns on the Users tab). Only remove unused references inside `PermissionsTab`.

**Out of scope:** No changes to the database, the `role_permissions` table, the Users tab, or built-in role assignment elsewhere. Existing built-in role permission rows in the DB remain but are no longer editable from this screen.
