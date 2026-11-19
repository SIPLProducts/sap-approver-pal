# Executive design preview: Transportation (90%) Exception Billing Approvals

Try the new look on one screen first (plus the sidebar and top bar while that screen is open). Every other screen keeps today's look until you approve a full rollout.

## What you will see
- **Brand:** Re Sustainability Red (#D01F25) for main buttons, the active menu item, selected radio and focus rings, with soft rose tints for hover/active states.
- **Sidebar:** deep charcoal (#16181D) with a red active marker; same menu items, order and icons.
- **Top bar:** crisp white with a subtle #E5E7EB bottom border.
- **Page:** soft neutral canvas (#F4F5F8), white cards with #E5E7EB borders and a very light shadow.
- **Filter card:** compact, evenly spaced Plant / Execute / Reset row and status row.
- **Table:** balanced executive density (compact rows, clear header row, soft dividers, light hover), tabular numerals for Plant, Customer and other codes.
- **Status column:** small rounded badges: emerald for Approved/Completed, amber for Pending/In Process/In Review, soft crimson for Rejected; anything else stays neutral grey.
- **Approve / Reject:** same position and behavior, recolored emerald and crimson to match.

## Not changing
- No icons replaced, removed or added anywhere.
- No change to SAP calls, payloads, Approve/Reject flow, popups, filters, Reset, permissions, menus or routes.
- Font stays Plus Jakarta Sans. Login page untouched. Other screens untouched.

## Technical details
- Add a scoped `.theme-exec` class in `src/styles.css` that overrides the existing tokens (primary, ring, background, card, border, sidebar-*) plus new `--success/--warning/--danger` soft tint tokens; light mode values above, dark-mode equivalents included.
- In `_authenticated.tsx`, add the `theme-exec` class to the layout wrapper only when the current path is `/imw/transportation-exception-billing-approvals` (class-only change; no logic touched).
- In the approvals screen, render the STATUS cell through a small `StatusBadge` helper (display only, row data unchanged), add `tabular-nums` to code columns, and tighten table/filter spacing via classes.
- Global rollout later = move the `.theme-exec` values to `:root` and remove the route condition.
- Verify with typecheck and a signed-in Playwright screenshot of the screen.
