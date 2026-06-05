## Goal
Split the single "Inbox" sidebar entry into two separate navigation items: **MM Approvals** and **SD Approvals**, so users can jump directly to the module they care about.

## Changes

### 1. Sidebar (`src/routes/_authenticated.tsx`)
Replace the single `Inbox` nav item with two entries:
- **MM Approvals** → `/inbox/mm` (Package icon)
- **SD Approvals** → `/inbox/sd` (Truck or ShoppingCart icon)

Keep History, Admin, and Settings as-is. The unread badge in the header stays global.

### 2. Routes
- Rename `src/routes/_authenticated/inbox.tsx` → `src/routes/_authenticated/inbox.$module.tsx` (dynamic `$module` param: `mm` | `sd`).
- The route component reads `module` from params, normalizes to `MM`/`SD`, removes the module tab selector, and shows only documents for that module. Title becomes "MM Approvals" or "SD Approvals".
- Add `src/routes/_authenticated/inbox.index.tsx` that redirects `/inbox` → `/inbox/mm` (backward-compat for any existing links, e.g. notification deep-links).

### 3. Link updates
- `src/routes/index.tsx`, `src/routes/_authenticated/notifications.tsx`, and any other place linking to `/inbox` → point to `/inbox/mm` by default, or keep `/inbox` (the index redirect handles it).
- Approval detail back-links use the document's `module` to return to the correct inbox.

### 4. Active-state highlighting
Sidebar `pathname.startsWith(it.to)` already works for `/inbox/mm` and `/inbox/sd` independently.

## Out of scope
- No DB / RLS / server-function changes.
- No change to the Sync SAP button, notifications, or push.
- Header bell still aggregates all unread.

## Technical notes
- TanStack file-based routing: `inbox.$module.tsx` maps to `/_authenticated/inbox/$module`. `routeTree.gen.ts` regenerates automatically.
- The current `inbox.tsx` already filters by `module` client-side via tab state — we just drive that filter from the route param instead.
