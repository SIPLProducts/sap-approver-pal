Update the user create/edit dialog in **src/routes/_authenticated/admin.users.tsx** so the password fields are disabled in edit mode unless the operator explicitly opts in to change them.

## Changes

1. **Add a `changePassword` state flag** in `CreateUserDialog`.
   - Default to `false`.
   - Reset to `false` whenever the dialog opens/closes or switches between add and edit.

2. **In edit mode, keep the password and confirm-password fields disabled by default.**
   - Set `disabled={editUser && !changePassword}` on both inputs.
   - Change the placeholder to indicate the field is locked (e.g. "******** — check Change Password to edit").
   - Show the password field `required` marker only when the field is actually editable (add mode or edit mode with change password checked).

3. **Add a "Change Password" checkbox at the bottom of the dialog body**, just above the footer.
   - Only visible when `editUser` is present.
   - Label: "Change Password".
   - When checked, enable the password fields and clear the sentinel values so the user can type a new password.
   - When unchecked, disable the fields again and reset password/confirm values back to `PASSWORD_SENTINEL`.

4. **Update validation logic.**
   - When creating a new user, password fields remain required as today.
   - When editing and "Change Password" is unchecked, skip password length/match validation and send empty strings to the server (preserving the existing password).
   - When editing and "Change Password" is checked, enforce the same 8-character minimum and confirm-password match rules.

## Not changing

- Server functions, DB, or other screens.
- The add-new-user flow (password fields stay editable by default).
- Existing `PASSWORD_SENTINEL` handling — it is still used to detect an unchanged password.

## Result

Editing an existing user will no longer expose editable password fields by default. Operators must check "Change Password" to unlock them, reducing accidental password resets.