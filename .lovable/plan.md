## SD Approvals: expand sub-menu AND navigate to Price Approvals

**File:** `src/routes/_authenticated.tsx` (SD Approvals nav button, ~line 172-182)

Change the button click handler so clicking "SD Approvals" both toggles the sub-menu open and navigates to the Price Approvals screen (`/sd/price`) in one click.

**Change:**
- Import `useNavigate` from `@tanstack/react-router` (if not already).
- Update the button's `onClick` to:
  1. If sidebar is collapsed, expand it.
  2. Set `sdExpanded(true)` (always open sub-menu, don't just toggle — avoids closing while navigating).
  3. Call `navigate({ to: "/sd/price" })`.
  4. Close the mobile drawer (`setOpen(false)`).

The existing `useEffect` that syncs `sdExpanded` with `sdOpen` remains, so the group stays visually expanded on the price route.

**Out of scope:** No changes to sub-item links, permissions, or the Price Approvals page itself.
