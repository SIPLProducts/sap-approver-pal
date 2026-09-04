# Price Master Update — Update mode credential popup

Add a credential-gate popup that opens as soon as the user selects the **Update** radio button on the Price Master Update screen. The popup contains User ID and Password fields plus an Execute button. Existing Execute logic remains unchanged.

## Behaviour

- When the user switches Mode from **Display** to **Update**, open a modal dialog immediately.
- The dialog contains:
  - **User ID** text input — empty by default, user types manually.
  - **Password** input — masked by default with an eye icon to toggle visibility, matching the login screen pattern.
  - **Execute** button at the bottom, disabled while either field is empty.
- Clicking **Execute** closes the dialog and runs the existing `execute()` function (same validation and SAP-not-configured toast).
- Clicking **Display** radio button while the dialog is open closes it and clears the credential state.
- Reset clears the credential state and closes the dialog.

## What stays the same

- The existing `execute()` function, results table, empty state, and all other Price Master Update logic are unchanged.
- No new SAP API call is added; the popup only gates the current Execute flow.
- No changes to permissions, route, sidebar, or other screens.

## Technical notes

- File: `src/routes/_authenticated/imw.price-master.tsx`.
- Add local state: `dialogOpen`, `dialogUserId`, `dialogPassword`, `showPassword`.
- Use existing `@/components/ui/dialog`, `@/components/ui/input`, `@/components/ui/label`, `@/components/ui/button`, and `Eye` / `EyeOff` icons from `lucide-react`.
- Keep styling consistent with the app design system (no hardcoded colors).
- Password input uses `type={showPassword ? "text" : "password"}` with an `aria-label` toggle button.
- The popup's Execute button calls the existing `execute()` after closing the dialog, so the current toast/info behaviour is preserved.
