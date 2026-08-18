Remove "Audit Ready" feature and image hover search icon on login page

## What changes
- Remove the "Audit Ready – Every action is tracked, timestamped and audit-logged" feature from the `FEATURES` list in `src/routes/login.tsx`.
  - Also remove the `FileCheck2` import if it is no longer used elsewhere in the file.
- Disable the browser's default hover image actions (search/visual icon) on the login page images by adding `pointer-events-none` to the hero image element.
  - The right-side line-art already has `pointer-events-none`; only the hero illustration needs the change.

## What stays the same
- All other feature items (Secure & Trusted, Role-Based Access, Timely Decisions).
- All login logic, authentication flow, redirects, forgot-password dialog, and styling.
- Trust strip, brand row, headline, and responsive layout.

## Verification
- Open `/login` and confirm the "Audit Ready" feature row is gone.
- Hover over the hero image on the left panel and confirm no search/magnifying icon appears.
- Run typecheck and `build:dev` to confirm no regressions.
