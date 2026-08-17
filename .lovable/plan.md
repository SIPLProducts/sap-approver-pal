# Fix login illustration visibility at 100% size

## Changes
- Keep the existing two-column login design and all authentication, forgot-password, and password-toggle behavior unchanged.
- Make the approval illustration visible from the desktop (`lg`) breakpoint instead of only at extra-large (`xl`) widths.
- Rebalance the left panel at common 100% desktop sizes so the logo, heading, illustration, feature list, and trust strip all fit within the viewport without clipping or nested scrolling.
- Use responsive size and short-height constraints for the illustration and vertical gaps while preserving the current visual proportions on larger screens.
- Keep the mobile layout unchanged and prevent the illustration from overlapping text.

## Verification
- Check the login page at the current 1114×687 viewport and additional standard/large desktop sizes at 100% zoom.
- Confirm the top logo and approval illustration are visible, the page has no unintended horizontal or vertical scrollbar, and all content remains inside its panel.
- Confirm the password eye icon still toggles visibility and existing sign-in/forgot-password wiring is unchanged.

## Technical details
- Scope changes to `src/routes/login.tsx` presentation classes only.
- The current issue is caused by the illustration class `hidden xl:block`, which evaluates to `display: none` at the current 1114px-wide preview.
