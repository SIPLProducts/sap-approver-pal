## Change

Update table header styling app-wide from the current light gray (#F8F9FA / slate text) to a dark charcoal (#1F2937) background with bold white text, while keeping sticky headers, padding, row hover, and alignment rules intact.

All table styling is centralized in `src/styles.css` via CSS variables and rules covering both Cloudscape tables (`.awsui-app-scope`) and native `<table>` / `.data-table` elements. Only that file needs to change.

### Edits in `src/styles.css`

1. Update the table header design tokens:
   - `--table-header-bg: #1F2937` (was `#F8F9FA`)
   - `--table-header-text: #FFFFFF` (was `#374151`)
   - `--table-header-border: #1F2937` (match bg so the divider stays clean on dark)
   - `--table-row-hover: #F1F2F4` (unchanged)

2. Ensure header text weight is bold (`font-weight: 700`) and padding stays in the 12–16px range for both Cloudscape and native tables (already the case; keep as-is).

3. Update the Cloudscape resizer color rule so the drag handle remains visible against the new dark header (use a light divider color instead of `--table-header-border`).

4. Keep sticky header positioning, left-align default, and right-align for `.num` / `[align="right"]` / `tabular-nums` cells — no changes needed there.

5. Leave the sticky first-column background (`var(--card)`) alone so body cells remain readable; only header cells go dark.

No component files, no business logic, no button styling changes.

### Technical notes

- Cloudscape header cell text color is enforced via the `[class*="awsui_header-cell-text"]` and sorting icon selectors already in place — they read from `--table-header-text`, so updating the token propagates automatically.
- Uppercase 12px header treatment already applied globally stays; only color/background change.
