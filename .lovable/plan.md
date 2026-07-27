## Goal
Ensure every table cell in the app lines up directly beneath its header column. Purely a presentation fix — no data, API, or business logic changes.

## Root cause
Two independent issues produce the "shifted column" look users see today:

1. **Cloudscape approval tables** (`src/components/aws/cloudscape-approval-table.tsx`, used across SD/MM approval screens): headers and body cells go through separate render paths. When one path applies `white-space: nowrap` / padding / right-align and the other doesn't, or when a column has a `minWidth` on the header cell but not the body cell (or vice versa), the body cell wraps/shrinks and drifts out from under its header. The global `.awsui-app-scope` rules in `src/styles.css` also target header vs body cells with different selectors, which can desync widths.

2. **Plain shadcn tables** (`Table` / `TableHead` / `TableCell` in `src/routes/_authenticated/mm.po-release.tsx`, `mm.pr-release.tsx`, `mm.gate-pass.tsx`, `mm.material-reservation.tsx`, `mm.gate-process.tsx`, etc.): header cells use `whitespace-nowrap` but some body cells render an `<Input>`/`<Checkbox>`/`<Select>` with its own min-width, or a numeric-aligned header (`text-right`) without the matching `text-right` on the cell. Result: the visible text of a cell sits under the neighbouring header.

## Fix (presentation only)

### A. Cloudscape approval table
In `src/components/aws/cloudscape-approval-table.tsx`:
- Ensure every column definition applies the same `minWidth`, `align`, and `whitespace` to both the header render and the cell render. Pass a single `align` value through to both `<th>` and `<td>` (currently `align: "right"` is only honoured on the cell).
- Use `table-layout: fixed` on the underlying table when column `minWidth`s are set, so the browser can't reflow one row's column wider than the header.

In `src/styles.css` under `.awsui-app-scope`:
- Consolidate header + body cell rules into a single selector list so padding, `white-space: nowrap`, and `text-align` stay in sync. Remove any header-only or body-only overrides that don't have a mirror on the other side.

### B. Shadcn tables in MM screens
For each of `mm.po-release.tsx`, `mm.pr-release.tsx`, `mm.gate-pass.tsx`, `mm.material-reservation.tsx`, `mm.gate-process.tsx`:
- Extract the per-column class string (e.g. `whitespace-nowrap text-xs` + optional `text-right` for numeric keys) into one constant used by both `<TableHead>` and `<TableCell>` for that key. This guarantees alignment + wrapping match.
- For editable cells (Input/Select/Checkbox), remove ad-hoc `min-w-[…]` on the inner control and instead put the min-width on the `<TableCell>` (and mirror it on the `<TableHead>`) so the header follows the widened cell.
- Numeric columns (e.g. `RLWRT`, `NETPR`, `NETWR`, `MENGE`, `APPROVED_QTY`): apply `text-right` on both head and cell; wrap the inner input in a right-aligned container.
- Selection checkbox column: fix a shared width (`w-10`) on both `<TableHead>` and `<TableCell>` (today only the head has it in some screens).

### C. Dynamic-column builder
`src/lib/sd/dynamic-columns.tsx` already returns a single `align` + `minWidth` per column. Confirm consumers pass both values to the header and cell in the Cloudscape wrapper (change A makes this automatic).

## Out of scope
- No changes to data fetching, server functions, migrations, permissions, or SAP payloads.
- No visual redesign — colours, fonts, and header styling stay as-is; only column geometry/alignment is corrected.

## Verification
- Load each affected screen (SD contract/price/sales-order/SC-SO reports, MM PR Release, PO Release, ZNFA Rating, Material Reservation, Gate Pass, Admin Users) and confirm:
  - Every body cell sits directly under its header, including after horizontal scroll and after resizing/zooming.
  - Numeric columns are right-aligned in both header and cell.
  - Editable cells (Input/Select/Checkbox) no longer push neighbouring columns out from under their headers.
