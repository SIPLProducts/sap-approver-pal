Move the Status field to the last position in the Create/Edit User dialog while keeping the existing three-column grid layout.

### Scope
- File: `src/routes/_authenticated/admin.users.tsx`
- Component: `CreateUserDialog` (used for both Create User and Edit User)
- Only the field order changes; no backend, validation, or server-function changes are required.

### New field order (three columns per row)
- Row 1: User ID, First Name, Last Name
- Row 2: Email ID, Contact Number, Plant
- Row 3: Role, Password, Confirm Password
- Row 4: Change Password (Edit mode only), Status, (empty cell)

For Create mode, the Change Password checkbox is not rendered, so Row 4 will contain only Status in the second column with the other two columns empty.

### Implementation
1. Remove the Status `Field` from its current position (Row 2).
2. Add it after the Confirm Password `Field` so it becomes the last field in the form.
3. Keep the existing `grid grid-cols-1 md:grid-cols-3 gap-4` container and all other field behavior unchanged.