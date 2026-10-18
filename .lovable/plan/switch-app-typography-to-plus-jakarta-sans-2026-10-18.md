# Switch app typography to Plus Jakarta Sans

Typography-only change. No colours, layout, logic, server functions or SAP payloads touched.

## Changes
1. **Font loading** (`src/routes/__root.tsx`): replace the IBM Plex Google Fonts link with Plus Jakarta Sans (300–800). Keep preconnects.
2. **Tokens** (`src/styles.css` `@theme inline`): `--font-sans`, `--font-display`, `--font-mono` all set to Plus Jakarta Sans with system fallbacks.
3. **Numeric alignment**: add `font-variant-numeric: tabular-nums` to `.font-mono` and all `td`/`th` cells.
4. **Cloudscape override**: `.awsui-app-scope, .awsui-app-scope *` use `var(--font-sans)` (Cloudscape ships Open Sans). Colours/sizes untouched.
5. **Popups/toasts**: force `var(--font-sans)` on `.swal2-popup` / `.swal-brand-*` and `[data-sonner-toaster]`.
6. **Type scale**: h1–h3 and `.font-display` → weight 700, letter-spacing -0.025em; body stays 400; add `.eyebrow` utility and apply 0.1em / 600 to existing `uppercase tracking-*` small labels via a CSS rule on `.uppercase.text-xs`/`text-[10px]|[11px]`.
7. **Cleanup**: remove all "IBM Plex" references (root link, styles comments, memory note updated to Plus Jakarta Sans).
8. **Fit check**: Playwright at 1366×768 on login, sidebar, a table screen; trim font-size/padding only if wrapping/clipping appears.

## Files
- `src/routes/__root.tsx`
- `src/styles.css`
- `mem://design/visual-identity`, `mem://index.md` (font note)
