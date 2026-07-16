Plan: Hide the selection form after a successful fetch on the Material Reservation screen

Scope: UI-only change in the existing Material Reservation route.

Implementation:
1. In `src/routes/_authenticated/mm.material-reservation.tsx`, add a `hasResults` flag (`rows.length > 0`).
2. Render the selection card (Document Number, HOD Approve, User ID, Execute/Reset) only when `!hasResults`.
3. Render the `CloudscapeApprovalTable` only when `hasResults`.
4. Wire the existing `reset()` function to clear the rows so the selection card reappears, and expose a "Back to Search" / "Reset" action in the table header extras so users can return to the search form.
5. Keep the success toast and row-selection behavior unchanged.

No backend, route, or navigation changes are needed. Admin still must create the `Material_Reservation_Fetch_API` SAP API config as before.