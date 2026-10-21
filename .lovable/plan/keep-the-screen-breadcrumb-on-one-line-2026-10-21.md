# Keep the screen breadcrumb on one line

Most of what was asked is already in `src/components/exec/page-header.tsx` from the earlier change:
- header mb 24px
- 16px icons, with the last breadcrumb item in foreground colour
- h1 at 24/32 bold
- subtitle at 16/24 with mt 4px

## Change (this file only)
- Breadcrumb `<nav>`: remove `flex-wrap` so the class reads `flex items-center gap-[4px] text-[14px] leading-[20px] text-muted-foreground mb-[12px]`. The breadcrumb then always stays on a single line.

No text, props, logic or other files change. ZNFA Release already passes eyebrow "MM Approvals", title "ZNFA Release" and its subtitle. It will show: Home > MM Approvals > ZNFA Release, then the title, then the subtitle.

## Check
- Typecheck, then confirm that page-header.tsx is the only file changed.
