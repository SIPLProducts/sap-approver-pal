## Problem

In Admin → Users → Edit User dialog:

1. If the operator edits any field but doesn't touch the password, the SAP Edit payload is sent with `PASSWORD: "********"` (the masked sentinel), which overwrites the real password in SAP with literal asterisks.
2. Clicking the eye/"view" icon on the password field shows `********` instead of the user's actual current password.
3. The password / confirm-password inputs are editable even when the "Change Password" checkbox is unchecked, which is what lets the sentinel leak into the payload.

## Root cause

- `Create_User_Display_Table` (the SAP list API) already returns `ZPASSWORD` and `ZCONFPSWD` for each user, but `listSapUsers` throws that field away — it never appears on the row objects that feed the edit dialog.
- The edit dialog therefore has no real password to pre-fill, so it fills both password fields with the constant `PASSWORD_SENTINEL = "********"`.
- On submit, when `changePassword` is unchecked, the form still sends `password: "********"` to `editUserViaSap`. The server treats any truthy `data.password` as a real password and forwards `PASSWORD: "********"` to SAP.
- The password inputs are only visually placeholdered — they remain enabled and typeable even when `Change Password` is off.

## Fix

Frontend — `src/routes/_authenticated/admin.users.tsx`:

- When opening Edit User, seed `form.password` / `form.confirm_password` from the row's real `ZPASSWORD` / `ZCONFPSWD` (fall back to empty string if missing) instead of `PASSWORD_SENTINEL`. Keep the value in state so it can be sent back untouched.
- Disable (`disabled` + muted styling) both password inputs and the show/hide eye button whenever `editUser && !changePassword`. Update placeholders accordingly.
- When the operator toggles `Change Password`:
  - ON → clear both fields so they can type a new password.
  - OFF → restore the original password from the loaded row (not the sentinel).
- On submit, always send the current `form.password` / `form.confirm_password` — the real existing password when unchanged, the freshly typed one when changed. Skip the "min 8 / must match" validation only when `!changePassword` (existing SAP value is trusted as-is).
- The eye/view toggle now reveals the real password because the field holds the actual value.

Backend — `src/lib/admin/user-mgmt.functions.ts`:

- Extend `listSapUsers` row mapping to capture `ZPASSWORD` / `ZCONFPSWD` (fallbacks: `PASSWORD`, `CONFPSWD`) into the returned row (e.g. `password`, `confirm_password`), so the client has them for the edit dialog.
- Extend the `Row` shape (both the aggregator and the outputted user object) to include these fields; do NOT log them in `admin_audit_log` (keep `sample_keys` only, no values).
- `editUserViaSap` keeps its current behavior of forwarding `PASSWORD` / `ZCONFPSWD` when provided — no server-side "change vs. unchanged" branching needed because the client now always sends the correct value. Continue masking them in the audit log.

No other routes or business logic are affected.

## Out of scope

- Storing SAP passwords anywhere in Lovable Cloud (they stay in memory only, sourced fresh from the SAP list API each time the dialog opens).
- Add User dialog behavior (unchanged).
