## Goal

Make every Cloudscape approval table (MM Gate Pass, Material Reservation, ZNFA Rating, all SD approval screens, Inbox, History, etc.) look like the PR Release shadcn table, and color the table header with the app's primary theme token. No logic, API, or column changes.

## Approach

Do this purely in CSS by targeting Cloudscape's rendered classes inside the existing `.awsui-app-scope` wrapper already used by `CloudscapeApprovalTable`. This means one file — `src/styles.css` — and zero changes to any route or component.

## Changes

Add a new `.awsui-app-scope` style block in `src/styles.css` that:

1. **Container** — matches PR Release's `border rounded-md` wrap:
   - Round the outer container, add a 1px `--border` border, hide overflow so header corners clip cleanly.

2. **Header row** — the requested theme-blue (primary) header:
   - `background: var(--primary)` on the header cells.
   - `color: var(--primary-foreground)` on header text (including sort labels and the select-all checkbox area).
   - Slightly bolder weight, `text-xs`-equivalent size, same horizontal padding as PR Release.
   - Remove Cloudscape's default header divider so the block reads as one solid bar.

3. **Body rows** — match PR Release spacing/typography:
   - `text-xs` cell font size, `whitespace-nowrap` (already enforced globally — keep).
   - Row height and vertical padding tightened to match `TableCell` defaults.
   - Zebra striping switched from Cloudscape's default to `--muted` at ~40% for the odd row, matching the subtle shadcn look.
   - Selected row uses `--accent` background (matches `data-[state=selected]` in shadcn Table).
   - Hover row uses `--muted`.

4. **Filter + pagination toolbar** — keep Cloudscape controls but nudge spacing/typography to align with PR Release's results header row (small muted meta text on the left, search input on the right). Achieved by tightening the header container padding.

5. **Checkbox column** — align width and center the checkbox with the row content, matching PR Release's `w-10` checkbox column.

All rules are scoped under `.awsui-app-scope` so they cannot leak into non-Cloudscape tables (shadcn Table, admin screens, dashboards).

## Files touched

- `src/styles.css` — one appended block, ~60 lines of scoped CSS.

Nothing else changes: no component, no route, no `CloudscapeApprovalTable.tsx` props, no business logic.

## Verification

- Open MM → Gate Pass, Material Reservation, ZNFA Rating: header bar is theme-red (the app's primary), rows look like PR Release, checkboxes still toggle, Save/Accept/Reject still work.
- Open SD → Contract, Sales Order, Service Certificate, BMW Status, all Reports: same header color, same row density, filter + pagination still functional.
- Open Inbox and History: same look.
- PR Release itself is untouched (it doesn't use Cloudscape) and remains the visual reference.
- Dark mode: header stays primary with `--primary-foreground` text — contrast preserved via tokens.
