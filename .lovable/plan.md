# Login Page: Fit Fully On Any Screen Size

Make `/login` scale so the whole page — hero panel, features, illustration, trust strip and sign-in form — stays fully visible at large widths and short heights, without clipping or extra scrolling. Layout, proportions and all auth logic stay exactly as they are.

## What changes

- Page container: keep the two-column split, but cap the content with a centred max width so on very wide monitors the panels don't stretch and the illustration doesn't push content out of view. Column ratio stays the same.
- Hero panel: allow the inner block to shrink gracefully — vertical rhythm (gap/padding) scales with viewport height instead of fixed large spacing, so on short-but-wide windows (e.g. 1920x800) nothing overflows behind the trust strip.
- Illustration: switch from a fixed `24rem` width to a fluid width that shrinks with available space and is clamped by viewport height, so it never forces horizontal overflow.
- Feature list and trust strip: text containers get min-width-0 and truncation-safe wrapping so items compress rather than clip at tighter widths.
- Sign-in column: form card keeps its current max width and centring; background line-art is constrained so it stays inside the column instead of being cropped oddly on wide screens.
- Scrolling: page height moves from `min-h-dvh` on both columns to a container that fits the viewport when it can, and only scrolls the hero content when a very short viewport truly requires it — no page-level scrollbar on normal desktop sizes.

## What stays the same

- All markup structure, copy, colors, fonts and design language.
- `sapLogin` / Supabase fallback submit flow, redirect to `/inbox`, SAP profile caching.
- Forgot-password dialog, `sapForgot` call, toasts, validation and busy states.

## Technical notes

- Only `src/routes/login.tsx` class names are edited (plus, if needed, a small additive utility in `src/styles.css`). No handler, state or import logic is touched.
- Responsive approach: `clamp()`-based sizing via Tailwind arbitrary values for hero padding/gaps and illustration width, `min-w-0` on flex text wrappers, `mx-auto max-w-[1600px]` style capping on the grid, and `min-h-dvh` replaced with `h-dvh` + internal `overflow-y-auto` only where required.
- Verification: browser screenshots at 1280x800, 1440x900, 1920x1080 and 2560x1200 plus a short-height 1600x720 case, confirming no clipped content and no unexpected scrollbars.
