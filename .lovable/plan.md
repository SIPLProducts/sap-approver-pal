# Login Page Redesign (match reference)

Rebuild the visual layer of `/login` to match the reference image exactly, keeping all current authentication behaviour untouched.

## What changes visually

Left panel (deep navy, ~55% width):
- Logo tile (white rounded square) + "Re Sustainability" with gold "EXECUTIVE APPROVALS" kicker.
- Headline: "Approvals" in white, "that drive progress." in gold, with a short gold rule underneath.
- Sub-copy paragraph in muted white.
- Four feature rows, each with a gold-outlined rounded icon tile: Secure & Trusted, Role-Based Access, Timely Decisions, Audit Ready — bold white title + two-line muted description.
- A hero illustration (approval clipboard / shield / laptop) sitting to the right of the copy, hidden on small screens.
- Bottom trust strip separated by a hairline: Secure (SSO · MFA · SAP-certified), Reliable (99.9% Uptime), Efficient (Faster approvals, better outcomes) with gold icons and thin vertical dividers, plus the centred copyright line below.

Right panel (near-white with faint blue tint):
- Faint background line-art (shield + building/office scene, low opacity) as decoration.
- "WELCOME TO RE SUSTAINABILITY" in indigo letter-spaced caps with a short gold underline.
- "Sign in to your Account" heading + supporting sentence.
- User ID field with a person icon inside the input; Password field with a lock icon and "Forgot Password?" link aligned right of the label.
- Inputs styled as the reference: soft blue-tinted fill, light border, taller height, rounded.
- Full-width deep-indigo "Sign in →" button.
- Mobile: single column — logo, heading, form; hero art and trust strip collapse.

## What stays the same

- `sapLogin` / Supabase fallback submit flow, session redirect to `/inbox`, SAP profile caching.
- Forgot-password dialog and `sapForgot` call, toasts, busy states, validation (required, minLength 8).
- No changes to any other route, hook, or server function.

## Technical notes

- Only `src/routes/login.tsx` is rewritten (markup/classes), plus additive tokens/utilities in `src/styles.css` if needed for the gold rules and input fill.
- All colours come from existing semantic tokens (`--gradient-exec`, `--gold`, `--primary`, `--background`); no hardcoded hex in components.
- Two illustrations are generated as project assets: the navy-panel approval hero (transparent PNG) and the light office line-art used at low opacity on the right panel.
- Icons keep using `lucide-react` (ShieldCheck, ClipboardList, Clock, FileCheck2, BarChart3, Zap, User, Lock, ArrowRight).
