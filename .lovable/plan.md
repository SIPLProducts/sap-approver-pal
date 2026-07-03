## Style Cloudscape table headers with sidebar background

Apply the dark graphite sidebar color (`var(--sidebar)` / `var(--sidebar-foreground)`) to the Cloudscape table header row on all 5 approval screens (Contract, SC/SO, Sales Order, Price, BMW Status).

### Change
In `src/styles.css`, add scoped overrides under the `.awsui` wrapper that target Cloudscape's table header cells:

```css
.awsui table thead th,
.awsui [class*="awsui_header-cell"] {
  background-color: var(--sidebar) !important;
  color: var(--sidebar-foreground) !important;
  border-color: var(--sidebar-border) !important;
}
.awsui [class*="awsui_sorting-icon"],
.awsui [class*="awsui_header-cell"] * {
  color: var(--sidebar-foreground) !important;
}
```

Also style the selection checkbox header cell and resize handles to blend with the dark header.

### Scope
- CSS-only change in `src/styles.css`.
- No changes to the 5 route files or `CloudscapeApprovalTable`.
- Screens affected: `sd.contract`, `sd.sc-so`, `sd.sales-order`, `sd.price`, `sd.bmw-status` (all already wrapped in `.awsui`).
