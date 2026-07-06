## Fix 1 — Table header background

The existing header-color rules in `src/styles.css` (~lines 207–221) target `.awsui …`, but the Cloudscape wrapper renders as `<div className="awsui-app-scope">`, so the selectors never match and headers stay white.

Rescope the same rules under `.awsui-app-scope`, keeping the tokens (`var(--sidebar)` / `var(--sidebar-foreground)` / `var(--sidebar-border)`):

- Header cells: `.awsui-app-scope table thead th`, `.awsui-app-scope [class*="awsui_header-cell"]` — sidebar background + sidebar-foreground text + sidebar-border border.
- Header text / sort icons: descendants under `[class*="awsui_header-cell"]`, plus `[class*="awsui_header-cell-text"]` and `[class*="awsui_sorting-icon"]` — sidebar-foreground color.
- Column resizer handles: `[class*="awsui_resizer"]` — sidebar-border background.

Applies to every screen using `CloudscapeApprovalTable` (Price, Contract, Sales Order, SC/SO, BMW Status).

## Fix 2 — Approve / Reject button colors

`CloudscapeApprovalTable` renders the header Accept/Reject Cloudscape `<Button>`s. Cloudscape ignores Tailwind classes, so color them via CSS scoped to the table header actions:

Add to `src/styles.css`:

- **Accept (primary, positive):** target Cloudscape's primary button inside the table header actions — `.awsui-app-scope [class*="awsui_header"] [class*="awsui_variant-primary"] button` — with a success-green background and white text; darker green on `:hover`/`:focus`; keep the disabled state muted (reduced opacity, no color override).
- **Reject (normal, destructive):** target the "normal" variant sibling — `.awsui-app-scope [class*="awsui_header"] [class*="awsui_variant-normal"] button` — with `var(--destructive)` background and `var(--destructive-foreground)` text; darker on `:hover`/`:focus`; muted disabled state.
- Keep the existing `iconName="check"` / `iconName="close"` icons; force icon color to inherit so it matches the button text.

Use existing tokens where they exist (`--destructive`, `--destructive-foreground`); introduce `--success` / `--success-foreground` values already used elsewhere in `styles.css` if present, otherwise inline a green OKLCH pair in the same block.

## Verification

After edits, refresh the SD Price screen (currently open) and one selection-enabled screen (e.g. Contract) and confirm:
- Table header row uses the dark sidebar color with light text.
- Accept button is green, Reject button is red, both readable, hover states visible, disabled states dimmed.

## Out of Scope

- No changes to route files, `CloudscapeApprovalTable` JSX, or button variants/props.
- No changes to non-header table body styling, sidebar tokens, or other screens outside SD.
