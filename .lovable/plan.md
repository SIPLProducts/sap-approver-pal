## New screen: PR Release (MM Approvals)

Placed immediately after MM Dashboard, before ZNFA Rating.

### Route
- New file: `src/routes/_authenticated/mm.pr-release.tsx`
  - Path: `/_authenticated/mm/pr-release`
  - Layout mirrors ZNFA Rating / Material Reservation (page title + selection-screen Card).

### UI
- Page title: **PR Release**
- Selection screen card containing:
  - Radio group with two options: **Single Level**, **Multiple Level** (using shadcn `RadioGroup`). Default: Single Level.
  - When either radio is selected (i.e. always visible once a level is chosen), show:
    - **Release Group** – text input
    - **Release Code** – text input
    - **Execute** button + **Reset** button (styled identically to other MM screens)
- No API wiring yet — Execute is a placeholder (toast "Not implemented") since the user didn't specify an API. Business logic hooks can be added later without structural changes.

### Sidebar
- `src/routes/_authenticated.tsx`: add "PR Release" link under MM Approvals, immediately after MM Dashboard and before ZNFA Rating. Gated by the existing MM Approvals permission (no new screen key, matching the current convention where MM sub-screens inherit from MM Approvals).

### Not changing
- No new SAP API config, no new server function, no permission/screen-key additions, no changes to other MM screens.
