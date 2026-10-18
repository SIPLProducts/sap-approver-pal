# Restyle the screen title area (breadcrumb + title row)

## 1. Shared header (`src/components/exec/page-header.tsx`)
Same props: eyebrow, title, subtitle, meta, actions, className. All 33 screens that use it pick up the change on their own.
- **Breadcrumb:** a Home icon that links to "/", then a chevron, then each part of the eyebrow (split on " · ", shown as plain muted text), then a chevron and the title in foreground colour. With no eyebrow it shows Home > title.
- **Title row:** the title (`text-2xl font-bold tracking-tight`, wraps instead of being cut off), the subtitle in normal body size, and the meta row as it is now. Actions sit on the right.
- **Wrapper:** `mb-6 animate-slide-up`.
- When the title isn't plain text, the breadcrumb's last item uses the same content.

## 2. `src/styles.css`
Add the `slide-up` keyframes and the `.animate-slide-up` class. They are turned off when the user's system is set to reduce motion. No colour tokens change.

## 3. The three screens
- **`sd.sc-so-reports.tsx`:** swap its own heading for PageHeader (eyebrow "BMW Reports", same title text). The back-arrow button moves into the header's actions area, and everything below stays the same.
- **`mm.dashboard.tsx` and `inbox.index.tsx`:** I'm leaving these two alone. They have no title or subtitle. One sends you straight to the MM inbox before anything shows, and the other only shows "Loading…" for a moment before redirecting. Adding a header would mean making up title text, which the brief says not to do. The screens they lead to already use the shared header.

## 4. Checks
- Typecheck.
- Playwright at 1366×768, in light and dark mode, on the Transportation screen, SC/SO Reports and SAP API Settings. This checks that the breadcrumb fits and that the actions line up.
- List every file changed.
