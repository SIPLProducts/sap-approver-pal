# Optional Last Name + Gate Pass response popup

## 1. User Creation — Last Name optional

- In the user form, drop the "First and Last name are required" guard so only First Name is checked, and remove the `required` marker on the Last Name field label.
- Relax the server-side validation for Last Name from "at least 1 character" to optional/empty-allowed in the create, update, and SAP-sync user functions, keeping full-name composition working when Last Name is blank.

## 2. Gate Pass — no mandatory approval flag on the selection screen

- Remove the client-side gate that stops Execute when no approval flag (HOD Approval etc.) is ticked, so Execute runs with the checkboxes left unchecked. The existing User ID requirement stays.

## 3. Gate Pass — exact SAP response popup after Save

- Add the same response dialog used on PR Release / PO Release: a modal listing the exact SAP message text returned by the save call, with a Close button.
- On Save success or failure, open that dialog with the SAP `MESSAGE` / `MSGTXT` value verbatim (plus document number when SAP returns one) instead of only a toast.
- Keep the existing refresh-after-save behaviour and all other logic untouched.

## Technical notes

- Files: `src/routes/_authenticated/admin.users.tsx`, `src/lib/admin/user-mgmt.functions.ts`, `src/routes/_authenticated/mm.gate-pass.tsx`.
- Reuse `extractSapMessage` from `src/lib/mm/sap-message.ts` and the shadcn `Dialog` markup pattern already present in `mm.pr-release.tsx` for a consistent look.
- No database, RLS, or SAP config changes.
