## Plan

1. **Fix Admin screen visibility after login**
   - Update the SAP login profile parser so role activities are read from all common response shapes, not only `ACTIVITIES`.
   - Support activity arrays named `ACTIVITY`, `ACTIVITIES`, `SCREEN`, `SCREENS`, and nested objects containing `ACTIVITY`, `SCREEN`, or `CODE`.
   - Keep the screen mapping driven by `screen-keys.ts`; no role-name hardcoding.

2. **Make active role defaults stable after login**
   - Tighten the active plant/role repair logic so stored stale selections cannot leave the Admin role with partial or empty activities.
   - When a valid role is selected/defaulted, persist that role cleanly so the sidebar uses the current SAP profile immediately.

3. **Default all permissions for selected screens on role create/edit**
   - In `createCustomRoleViaSap` and `editCustomRoleViaSap`, insert one `role_permissions` row for every selected screen and every action in `PERMISSION_ACTIONS`: `view`, `create`, `edit`, `delete`, `approve`, `export`.
   - This means new roles start with all actions enabled for each selected screen, and users can later turn individual actions off in the permission matrix.

4. **Fix permission matrix row matching**
   - Update the toggle logic so it matches an existing permission by both `screen_key` and `action`.
   - This prevents toggling one action from accidentally updating the first permission row for that screen.

5. **Validate**
   - Check TypeScript-level syntax for the touched files via the normal harness.
   - Verify from code paths that selected screens create full permission rows and Admin activities map to sidebar screens without hardcoded role checks.