# Login cleanup + single Plant selection on PR/PO Release

## 1. Login page
- Remove the "Don't have an account? Create one" toggle button and the sign-up mode entirely from the login screen, so only SAP/corporate sign-in and Forgot Password remain.
- The sign-up heading/full-name field and the sign-up branch of the submit handler go away with it. Sign-in behaviour is untouched.

## 2. PR Release and PO Release — Plant becomes single-select
- Replace the multi-select Plant control with the existing single-select Plant dropdown, still fed by the GET_USER_PLANT list and still limited to the plants chosen in the top bar.
- Default value: the first plant from the top-bar selection (instead of all of them).
- Release Group / Release Code F4 lists keep filtering by the chosen plant, and Execute still requires a plant to be chosen.
- The SAP payload keeps its current shape; it now simply carries the one selected plant.
- Everything else on both screens (columns, actions, confirmations, table behaviour) stays as-is.

## Technical notes
- `src/routes/login.tsx`: drop `mode` state, sign-up form fields, sign-up submit branch, and the mode-switch button.
- `src/routes/_authenticated/mm.pr-release.tsx` and `mm.po-release.tsx`: swap `PlantMultiSelect` for `PlantSelect` (`source="user-plant"`), change `plants: string[]` state to a single `plant: string` initialised to `activePlants[0] ?? ""`, and pass `[plant]` where the existing mutation/`releaseKeysFor` calls expect an array so no server function signature changes.
