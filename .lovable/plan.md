Update the user-management form dialog so the fields are arranged in a three-column grid instead of the current single column.

### Scope
- File: `src/routes/_authenticated/admin.users.tsx`
- Component: `CreateUserDialog` (used for both Create User and Edit User)
- No backend or server-function changes are required.

### Changes
1. Widen the dialog to fit three columns by changing `DialogContent` from `max-w-md` to a wider size (e.g., `max-w-5xl`).
2. Replace the single-column `space-y-4` container with a responsive grid: `grid grid-cols-1 md:grid-cols-3 gap-4`.
3. Keep the existing `Field` wrapper and input/select behavior unchanged.
4. Place fields in three-column rows:
   - Row 1: User ID, First Name, Last Name
   - Row 2: Email ID, Contact Number, Status
   - Row 3: Plant, Role, Change Password (shown only for Edit User)
   - Row 4: Password, Confirm Password (only two fields in Create mode; the third column stays empty to preserve alignment)
5. For Edit User, the Change Password checkbox remains in its own field cell and still toggles the password/confirm-password inputs on/off.
6. Keep the same responsive fallback: on small viewports the grid collapses to a single column so the form remains usable on mobile.
7. No changes to validation, submit payload, or server-function calls.