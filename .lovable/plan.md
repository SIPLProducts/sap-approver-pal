Apply the requested header styling to the shared table component (`CloudscapeApprovalTable`) so every approval screen inherits it, and keep the brand red color for actions only.

### What will change

1. Add semantic color tokens in `src/styles.css` for the exact colors requested:
   - `--table-header-bg: #F8F9FA`
   - `--table-header-text: #374151`
   - `--table-header-border: #E5E7EB`
   - `--table-row-hover: #F1F2F4`

2. Update `src/components/aws/cloudscape-approval-table.tsx`:
   - `TableHead` cells: light gray background, dark slate gray bold text, `1px` bottom border, `12px-16px` padding, sticky on scroll (`sticky top-0 z-10`), left-aligned text.
   - `TableRow` rows: hover background using `--table-row-hover`.
   - Right-align `TableCell` when `column.align === "right"` (numbers); all other cells remain left-aligned.
   - No red colors on headers or rows; keep red only on the Accept/Reject buttons and status badges.

3. Leave the `Table` wrapper's existing overflow and border behavior intact, only changing header/row presentation.

### What will NOT change
- No business logic, API payloads, or route behavior.
- No changes to other table variants unless they share the same component.
- No color changes to buttons or status badges; brand red (#d4202a) stays where it already is.

### Verification
- Build the project to confirm no type or style errors.
- Spot-check an approval screen (e.g., PR Release, Gate Pass) to confirm the header is gray, sticky, bold, and row hover is applied; numeric columns remain right-aligned.