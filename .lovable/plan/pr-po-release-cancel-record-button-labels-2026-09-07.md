# PR / PO Release — Cancel Record button labels

## What changes for the user

On the PR Release and PO Release screens:

- When the **Cancel Record** checkbox is ticked, the two action buttons read **Undo Release** and **Undo Reject**.
- When it is not ticked, they read **Release** and **Reject**, exactly as today.
- Nothing else changes: Execute, the fetch, the confirmation popups, the results table, selection and all SAP calls behave exactly as they do now.

## Scope

Labels only. No API integration, no payload changes, no validation or behaviour changes. Further cancel-record behaviour will be added later when the requirements arrive.

## Technical notes

- `src/routes/_authenticated/mm.po-release.tsx` and `src/routes/_authenticated/mm.pr-release.tsx`: derive the button text from the existing `cancelRecord` state (`cancelRecord ? "Undo Release" : "Release"`, `cancelRecord ? "Undo Reject" : "Reject"`).
- Keep the existing `onRelease` / `onReject` handlers, disabled logic, styling and confirmation dialog text untouched.
