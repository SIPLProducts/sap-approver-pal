# Fix title-area spacing to match RE Gate Entry (pixel values)

Only `src/components/exec/page-header.tsx` changes. This app's root font is 14px, so rem classes render smaller than Gate Entry; switch to fixed pixels.

## Changes
1. `<header>`: `mb-[24px] animate-slide-up` (className merge kept).
2. Breadcrumb `<nav>`: `flex flex-wrap items-center gap-[4px] text-[14px] leading-[20px] text-muted-foreground mb-[12px]`.
   - Home and every ChevronRight icon: `size-[16px]` (replaces `w-4 h-4`).
3. Title row wrapper: `flex items-start justify-between gap-[16px]`.
4. `<h1>`: `text-[24px] leading-[32px] font-bold text-foreground tracking-tight`.
5. Subtitle `<p>`: `text-[16px] leading-[24px] text-muted-foreground mt-[4px]`.

Unchanged: meta row, actions slot, breadcrumb logic, props, text, all other files.

## Check
- Typecheck.
- Screenshots at 1366x768, light and dark: PO Release, Price Approvals, Price Master Update.
- Confirm only page-header.tsx was modified.
