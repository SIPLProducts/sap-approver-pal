# Login Page: No Clipping at 100% Zoom + Password Eye Toggle

The screenshot shows the left hero panel scrolling inside its own box: the logo row at the top is cut off and an inner scrollbar appears. Fix that so the whole left panel (logo, headline, features, illustration, trust strip) is always visible, and add a show/hide eye icon to the Password field.

## What changes

Left hero panel
- Remove the inner scroll container behaviour that clips the top (logo row). The panel content flows from the top instead of being vertically centred inside a fixed-height, overflow-scrolling box.
- Hero vertical rhythm compresses further on short viewports so the four feature rows, illustration and trust strip fit without an inner scrollbar.
- If the viewport is genuinely too short for the content, the whole page scrolls normally instead of a nested panel scrollbar — nothing is hidden behind the trust strip.
- Illustration width/height clamps tightened so it never forces the text column to shrink or overflow.

Password field
- Eye / eye-off button inside the Password input on the right side, toggling between masked and plain text.
- Accessible label ("Show password" / "Hide password"), input padding adjusted so the text never sits under the icon.

## What stays the same

- Two-column layout, colors, typography, copy, spacing language, illustrations.
- `sapLogin` / Supabase fallback submit flow, redirect to `/inbox`, SAP profile caching.
- Forgot-password dialog, `sapForgot`, toasts, validation (required, minLength 8) and busy states.

## Technical notes

- Only `src/routes/login.tsx` is edited: class names on the page/hero containers plus a `showPassword` state and `Eye`/`EyeOff` icons from `lucide-react`.
- Height handling: drop `lg:h-dvh` + `lg:overflow-hidden` / `lg:overflow-y-auto` on the hero in favour of `lg:min-h-dvh` with `justify-start` content flow, keeping the trust strip pinned at the bottom via `mt-auto`.
- Verification: browser screenshots at 1114x687 (current preview size), 1280x800, 1440x900 and 1920x1080, confirming the logo row is visible, no inner scrollbar, and the eye toggle reveals the password.
