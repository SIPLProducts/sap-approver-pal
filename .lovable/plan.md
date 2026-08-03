# Premium consistency pass (no color changes)

Goal: one calm, professional look across every screen. Colors stay exactly as they are — this is consistency, polish, safety confirmations, and accessibility only.

## 1. One page header everywhere

`PageHeader` exists but is only used on two screens (inbox, email config). Every content screen gets the same pattern: eyebrow, title, optional subtitle, meta chips, actions on the right. The SD Dashboard's custom header is replaced with the shared one (its gradient hero band becomes a section below the header, not a competing header).

Same for page frame: every screen wraps content in the existing `page-shell` + `page-stack` rhythm and cards use `card-surface` / `card-pad`, so padding and vertical spacing match on all screens.

## 2. Buttons on the real color system

The green Accept/primary override in `src/styles.css` uses a hardcoded `oklch(0.62 0.17 145)` value instead of the app's `--success` token. Point those Cloudscape primary/normal overrides at `--success` / `--success-foreground` and `--destructive`, and sweep MM/SD screens for any other literal color utilities on buttons.

## 3. Confirmation before destructive actions

Add one shared confirm dialog (built on the existing `alert-dialog`) and require it before Reject, Release, and Delete in: PR Release, PO Release, MIGO Release, ZNFA Rating, Gate Pass, Material Reservation, the SD approval screens, and admin user/role/API delete actions. Dialog states the action, the number of selected rows, and uses destructive styling for Reject/Delete.

## 4. Skeletons and empty states

Replace plain "Loading…" text with the existing `skeleton-rows` / `skeleton` components (table skeletons for tables, block skeletons for cards) on every screen currently rendering text loaders. Where a fetch succeeds with zero rows, render the existing `empty-state` component with a short reason and the relevant action, instead of a blank area.

## 5. Approval detail screen

`/approval/$id` currently has no not-found path. Add: skeleton while loading, and a clear "Approval not found" empty state with a back-to-inbox action when the record is missing or the fetch fails.

## 6. Login toggle text

The sign-in/sign-up toggle button renders no label. Give it explicit text ("Create an account" / "Back to sign in") driven off the current mode.

## 7. MIGO Release popups

Replace SweetAlert2 usage in `mm.migo-release.tsx` with the app's dialog + sonner toasts so it matches every other screen. Remove the `sweetalert2` import from that screen.

## 8. ZNFA Release availability notice

Add a clear inline notice on the ZNFA Release screen stating the SAP service isn't wired up yet, so the screen reads as intentional rather than broken.

## 9. SD Dashboard chart colors

Chart palette values are wrapped in `hsl(...)` while the design tokens are `oklch`, so those colors resolve wrong. Drop the `hsl()` wrappers and reference tokens directly (`var(--destructive)`, `var(--primary)`, etc.), keeping the same intended hues.

## 10. Table number formatting

One shared number/date formatter applied across tables: numeric cells right-aligned with `tabular-nums`, thousands separators, fixed decimal places for amounts, and consistent date format. Applied through the Cloudscape approval table's cell rendering so every screen inherits it.

## 11. Accessibility: never color alone

Status badges and inline error messages get an icon plus text label (check / clock / alert), not just a color. Icon-only buttons get `aria-label`s where missing.

## Technical notes

- Files touched: `src/styles.css`, `src/components/exec/page-header.tsx` (minor), a new shared confirm-dialog component, a new shared formatters module, `src/components/aws/cloudscape-approval-table.tsx`, all `src/routes/_authenticated/*` screens, `src/routes/login.tsx`.
- No token value changes in `:root` or `.dark`; no business logic, API, or database changes.
- Verification: build/typecheck plus a Playwright pass over login, inbox, SD dashboard, PR/PO/MIGO release, approval detail, and admin users to confirm headers, skeletons, and confirms render.
