## Problem

Cloudscape's `stickyHeader` works by rendering a **duplicate copy** of the header row and pinning it. Because this app scrolls inside `<main className="overflow-y-auto">` (not the browser window), the pinned copy mis-docks — so while scrolling you see two headers: the original one scrolling away plus the floating clone.

## Fix — one real sticky header, scrolling inside the table

Stop using Cloudscape's clone-based sticky header entirely. Instead, make the table body scroll inside its own container with the actual `<thead>` pinned via CSS `position: sticky`. Since it's the same single header element, there is no duplicate, and column alignment stays perfect during both vertical and horizontal scrolling.

### Changes

1. **`src/components/aws/cloudscape-approval-table.tsx`**
   - Remove `stickyHeader` and `stickyHeaderVerticalOffset={56}` from the `<Table>` (this eliminates the cloned second header).

2. **`src/styles.css`** — add to the existing `.awsui-app-scope` overrides:
   - Cap the table's internal scroll wrapper (the element Cloudscape uses for horizontal scrolling) with a max height (`max-height: calc(100vh - 220px)`, leaving room for top nav + container header/filter) and `overflow: auto`, so rows scroll vertically inside the table itself.
   - Pin the real header: `thead th { position: sticky; top: 0; z-index: 10; }` with a solid background so rows never show through, keeping the existing header styling.

### Why this works for all requirements

- **One header only** — no cloned row, just the real `<thead>` pinned.
- **Vertical scroll** — rows scroll under the pinned header inside the table; the container title, Reject/Accept buttons, and filter stay visible above it.
- **Horizontal scroll** — header and body are the same `<table>` element sharing one scroll wrapper, so column widths and alignment can never drift, including with `resizableColumns`.
- **All SD screens fixed at once** — Price, Contract, SC-SO, Sales Order, and BMW Status all render through this single component.

### Verification

Load an SD Approvals screen with enough rows, scroll vertically and horizontally, and confirm via a Playwright screenshot that exactly one header row is visible and pinned.