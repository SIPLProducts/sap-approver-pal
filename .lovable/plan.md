# Match page padding and header spacing to RE Gate Entry (pixel values)

UI spacing only. All values are fixed pixels, because this app's base font is 14px.

## 1. `src/routes/_authenticated.tsx` (line 454, `<main>`)
`flex-1 overflow-y-auto p-2 lg:p-3` changes to `flex-1 overflow-y-auto p-[24px]`. The inner `max-w-[1600px]` wrapper and `<Outlet />` stay as they are.

## 2. `src/styles.css` (lines 239-245)
- `.page-shell`: `padding: 0`. Remove the 640px and 1024px media rules.
- `.page-stack > * + *`: `margin-top: 24px`. Remove the 640px media rule.
- The class names stay, so no screen files need edits.

## 3. `src/components/exec/page-header.tsx`
Already done in the previous change: header mb 24px, breadcrumb gap 4px / 14px / mb 12px, 16px icons, title row gap 16px, h1 24/32, subtitle 16/24 with mt 4px. No further edit.

Unchanged: page content, cards, tables, colours, text, logic, SAP payloads.

## Check
- Typecheck.
- At 1366x768 and 1920x1080, check PO Release, Price Approvals, Price Master Update, Admin Users and MM Dashboard. Measure that the breadcrumb, title and first card start 24px from the sidebar, with 24px between the header and the first card.
- Confirm that only these files changed.
