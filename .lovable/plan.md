## Goal

Apply a clean, enterprise data-app look globally without changing layout, structure, logic, or existing colors. All work is in one file: `src/styles.css` (plus one tiny tweak to the sticky top bar height in `src/routes/_authenticated.tsx` to hit the 56-64px spec).

## Typography

In `src/styles.css`:
- Switch `--font-sans` to `"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` and `--font-display` to the same stack so no display serif/italic sneaks in.
- Load Inter via a `<link>` in `src/routes/__root.tsx` `head()` (per Tailwind v4 rule — no remote `@import` in styles.css).
- Add base rules in `@layer base`:
  - `html, body { font-size: 14px; font-weight: 400; }`
  - `h1 { font-size: 20px; font-weight: 600; }`, `h2 { font-size: 18px; font-weight: 600; }`, both non-italic.
  - `em, i, cite, address { font-style: normal; }` to enforce no-italics.
  - `.text-xs { font-size: 12px; }` unchanged; column-header helper below sets 12-13px 600 uppercase.

## Top bar

- Bump sticky header height from `h-14` (56px) to `h-15` equivalent: change the `<header>` class in `src/routes/_authenticated.tsx` from `h-14` to `h-[60px]` and keep `border-b` (already 1px). No other layout changes. Breadcrumb-left / user-info-right structure is already present.
- Style active nav/tab indicator via CSS (styling only, no JSX change): add a rule targeting the existing active tab class used in the app tabs (`[data-state="active"]` on Radix Tabs) to draw a `2px` bottom border in `--primary` instead of the current pill style — scoped so it does not affect sidebar links.

## Tables (Cloudscape + shadcn)

Extend the existing Cloudscape overrides in `src/styles.css`:
- Row height: `.awsui-app-scope table tbody td { height: 40px; padding-top: 8px; padding-bottom: 8px; font-size: 13px; }`.
- Header cells: `font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;` (keeps existing sidebar-colored bg).
- Horizontal dividers only: `table { border-collapse: separate; } td, th { border-right: 0 !important; } tbody tr { border-bottom: 1px solid var(--border); }` scoped under `.awsui-app-scope` and also for plain `<table>` under a new `.data-table` utility for the few non-Cloudscape tables.
- Hover: `.awsui-app-scope tbody tr:hover td { background: color-mix(in oklab, var(--muted) 60%, transparent); }`.
- Sticky first column: `.awsui-app-scope tbody td:first-child, .awsui-app-scope thead th:first-child { position: sticky; left: 0; z-index: 5; background: var(--card); } .awsui-app-scope thead th:first-child { z-index: 11; background: var(--sidebar); }`.
- Right-align numbers: `.awsui-app-scope td.num, .awsui-app-scope td[data-type="number"], td.tabular-nums { text-align: right; font-variant-numeric: tabular-nums; }` (uses classes already emitted by existing components).
- Sticky header already handled; keep as-is.

## Scroll + spacing + radius

- `main` already scrolls; header and filter cards are already sticky/fixed within the shell — no layout change.
- Add a thin-scrollbar utility applied globally to scroll containers:
  ```css
  * { scrollbar-width: thin; scrollbar-color: color-mix(in oklab, var(--muted-foreground) 40%, transparent) transparent; }
  *::-webkit-scrollbar { width: 8px; height: 8px; }
  *::-webkit-scrollbar-thumb { background: color-mix(in oklab, var(--muted-foreground) 35%, transparent); border-radius: 6px; }
  *::-webkit-scrollbar-track { background: transparent; }
  ```
- Border-radius consistency: change `--radius` from `0.75rem` (12px) to `0.5rem` (8px) so shadcn `rounded-lg`/`md`/`sm` land in the 6-8px band. Kept as a token change so no component code touches.
- Spacing: not enforced globally (would break existing layout). The 8/12/16/24 rhythm is already the Tailwind default (`gap-2/3/4/6`) the app uses — no changes.

## Colors

Untouched. All `oklch` tokens in `:root` / `.dark` stay exactly as they are.

## Out of scope

- No JSX/layout restructuring beyond the single `h-14 → h-[60px]` on the header.
- No component logic changes.
- No color token changes.
- No new dependencies (Inter loaded via `<link>` tag).

## Verification

- `tsgo` typecheck.
- Visual pass on Contract Approvals, SC & SO Approvals, Sales Order Approvals and their Reports: font is Inter, header is ~60px, table rows ~40px with only horizontal lines, headers are 12px uppercase 600, first column sticky on horizontal scroll, hover highlight visible, scrollbars are thin, colors unchanged.
