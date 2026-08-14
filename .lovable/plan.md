# ZNFA dialog sizing + global page padding reduction

## Current state (verified)

- In `src/routes/_authenticated/mm.znfa-release.tsx`, the **Clarification** and **Display Clarification** dialogs both use `DialogContent className="max-w-lg"` (lines 2124 and 2176). The popups are therefore narrow for long clarification text and the Display Clarification textarea uses `rows={10}` within that constrained width.
- In `src/routes/_authenticated.tsx`, the authenticated main wrapper uses `p-4 lg:p-8` (line 393). This is the single shared wrapper that controls page content padding across every authenticated screen.

## What will change

### 1. Larger ZNFA Clarification / Display Clarification popups
- Increase the width and height of both dialogs without changing their internal layout, logic, button handlers, state, or API wiring.
- For both `Clarification` and `Display Clarification` `DialogContent` components, replace the `max-w-lg` class with a wider and taller size (e.g. `max-w-2xl min-h-[60vh]`). Exact class chosen will keep the existing design language and avoid overflow issues.
- No other changes to the dialogs: same textarea, same buttons, same `onOpenChange`, same mutation handling.

### 2. Reduce global page content padding
- In `src/routes/_authenticated.tsx`, update the shared `<main>` wrapper from `p-4 lg:p-8` to `p-3 lg:p-5` (or equivalent smaller spacing).
- This applies to every authenticated screen because it is the single `<Outlet />` wrapper.
- No individual screen padding will be touched; existing logic, headers, and components remain unchanged.

## Technical notes

- Only two files are affected:
  - `src/routes/_authenticated/mm.znfa-release.tsx` — dialog size className only.
  - `src/routes/_authenticated.tsx` — main wrapper padding className only.
- No schema, API, server function, or component logic changes.
- No functional changes to the Clarification / Display Clarification workflows.
