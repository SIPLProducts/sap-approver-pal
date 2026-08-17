# Redesign left login panel to exact executive spec

Re-work the left (hero) panel of `/login` to match the provided reference and specification precisely, while keeping the right sign-in panel and all authentication logic untouched.

## What changes

- **Background**: use `bg-gradient-exec` (135deg, `#0F1830` → `#1B2748`) as the base; keep the subtle white dot-grid overlay at ~25% opacity; keep the two large blurred ambient glows (blue `#2A3F87` bottom-left, gold `#B4703A` top-right) with very low opacity so they read as ambient light, not solid shapes.
- **Logo row**: white rounded-square badge (`rounded-2xl` ≈ 16px) containing the red circular "re" mark via `BrandLogo`; "Re Sustainability" in bold white; "EXECUTIVE APPROVALS" in small gold uppercase with wide letter-spacing.
- **Headline**: "Approvals" in large bold white; "that drive progress." in the same size in gold; short 60px gold rounded underline below; supporting paragraph in white/70.
- **Illustration**: keep the existing `login-hero-approvals.png` 3D approval artwork at a stable 280×280px, centered in its column, visible from the `lg` desktop breakpoint upward, with `object-contain` and a soft drop shadow. The artwork sits to the right of the headline/copy on the same row.
- **Feature list**: four stacked rows, each with a dark icon tile (gold/40 border, white/4 fill), gold icon, bold white title, and smaller white/60 description. Icons: ShieldCheck, ClipboardList, Clock, FileCheck2.
- **Trust strip**: pinned to the bottom of the panel via `mt-auto`, separated by a white/10 hairline, three columns with gold icons and vertical dividers (white/10), plus the centered copyright line in white/40.
- **Typography & spacing**: IBM Plex Sans throughout; clamped horizontal padding `px-[clamp(1.5rem,4vw,3.5rem)]` and vertical padding `py-[clamp(1.25rem,3vh,3rem)]` for generous 3.5rem edges on wide screens; corporate, premium, not playful.
- **Fit/responsiveness**: the left panel content must remain fully visible at 100% zoom and common desktop sizes (1114×687 up to 1920×1080) without clipping, nested scrollbars, or overflow. Use `lg:min-h-dvh` with `justify-start` content flow and `mt-auto` for the trust strip; keep the hero image stable at 280×280 and allow the text column to compress with `min-w-0`.

## What stays the same

- Right sign-in panel: layout, inputs, labels, password eye toggle, forgot-password link, sign-in button, background line-art.
- All authentication logic: Supabase fallback, SAP proxy login, `verifyOtp`, SAP profile caching, redirect to `/inbox`.
- Forgot-password dialog and its `sapForgot` handler.
- No changes to other routes, components, or server functions.

## Technical details

- File scope: only `src/routes/login.tsx` markup and classes are edited; no logic changes.
- The existing `src/assets/login-hero-approvals.png` and `src/assets/login-office-lineart.png` assets are reused.
- No new CSS tokens needed; the current `--gradient-exec`, `--gold`, `--primary`, and dot-grid utility already cover the spec.
- Verification: visual checks at 1114×687, 1280×800, 1366×768, 1440×900, and 1920×1080 to confirm the left panel logo, headline, artwork, features, and trust strip are all visible without clipping or nested scrollbars.
