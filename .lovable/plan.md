Fix two UX issues in the Edit User dialog (`src/routes/_authenticated/admin.users.tsx`) and its SAP call (`src/lib/admin/user-mgmt.functions.ts`).

## 1. Remove the "Missing required field(s): EDIT.PASSWORD, EDIT.ZCONFPSWD" error toast

Root cause: the SAP `Edit_User` endpoint requires `PASSWORD` and `ZCONFPSWD` keys to be present in the `EDIT` payload. Today, when the operator saves without ticking "Change Password", the server sends an empty string and then omits the keys entirely (`if (data.password) { ... }`), so SAP rejects the request.

Fix (server, `sapEditUser` handler around lines 781–784):
- Always include `PASSWORD` and `ZCONFPSWD` in `inner`.
- When the operator did not change the password, send the sentinel string `"********"` for both fields (same sentinel already used in the UI to represent "unchanged"). This satisfies SAP's required-field check without exposing or overwriting the actual password — SAP's Edit_User config already treats the sentinel as "no change" (that's why it's the existing convention in this project).
- Keep the audit-log masking (`PASSWORD: "***"`) so nothing sensitive is logged.

Fix (client, `submit` around lines 926–936):
- When `passwordUnchanged` is true, send `PASSWORD_SENTINEL` for `password` and `confirm_password` instead of empty strings, so the server always has a value to forward.

Result: saving an edit without changing the password no longer triggers the SAP "Missing required field(s)" toast.

## 2. Make the eye icon toggle both password fields

Currently only the Password field has a show/hide button; the Confirm Password field is always `type="password"` with no toggle, and the existing toggle sits inside a `relative` wrapper that works but does not visually align with the disabled state.

Fix (client, `Field label="Password"` and `Field label="Confirm Password"` around lines 1047–1076):
- Extract a small reusable pattern (or duplicate inline) so Confirm Password gets the same `Eye`/`EyeOff` toggle button as Password.
- Bind both fields' `type` to the same `showPw` state so a single click reveals/hides both values consistently.
- Ensure the toggle button remains clickable even when the input is disabled (button stays enabled; only the `<Input>` is disabled). Keep `aria-label` switching between "Show password" / "Hide password".

## Not changing

- Change Password checkbox behavior, validation rules, or the add-new-user flow.
- Any other screens, DB tables, or RLS.
- The `PASSWORD_SENTINEL` value itself.
