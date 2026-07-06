## Goal

In the SD Approvals screens, the Cloudscape table already sets `stickyHeader`, but the column-header row visually detaches from the container header and overlaps the first data rows on scroll (as shown in the screenshot). The fix is to tell Cloudscape where the top of the scroll viewport actually is so the sticky header docks cleanly under the app's top nav.

## Change

Edit `src/components/aws/cloudscape-approval-table.tsx`:

- On the `<Table>` (line 144-210), add `stickyHeaderVerticalOffset={56}` alongside the existing `stickyHeader` prop.
  - `56` matches the `h-14` sticky app top bar in `src/routes/_authenticated.tsx` (line 252), so the sticky header lands flush beneath it instead of behind it.
- Keep `resizableColumns`, `stripedRows`, `variant="container"` unchanged — Cloudscape's built-in sticky-header machinery already keeps column widths aligned during horizontal scroll and re-renders selection/row heights correctly.

No route-level changes needed — every SD Approvals screen (`sd.price`, `sd.contract`, `sd.sc-so`, `sd.sales-order`, `sd.bmw-status`) renders through this single table component, so the fix applies to all of them.

## Technical notes

- `stickyHeader` on Cloudscape's `Table` uses the nearest scrollable ancestor (the `<main className="overflow-y-auto">` in `_authenticated.tsx`). Without `stickyHeaderVerticalOffset`, it pins to the top of that scroll container — which sits under the sticky top nav — so the header row visually overlaps content.
- Horizontal scrolling: Cloudscape's sticky header is internally width-synced with the body table, so column alignment stays consistent when the user scrolls horizontally. No custom CSS or duplicate-header hacks needed.
- Container title + Reject/Accept buttons continue to scroll away naturally; only the column headers pin.