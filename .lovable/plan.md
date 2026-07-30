## Goal

Add a new **ZNFA Release** screen under MM Approvals, listed right after MIGO Release, with a Creation/Release mode switch that changes which action buttons are shown.

## What gets built

**New route:** `src/routes/_authenticated/mm.znfa-release.tsx` → URL `/mm/znfa-release`

Layout follows the existing MM screens (MIGO Release / Material Reservation pattern):
- Page header: title "ZNFA Release"
- A selection card containing:
  - A radio group with two options: **Creation** and **Release** (Creation selected by default)
  - An action button row that depends on the selected mode:
    - **Creation** → Create, Change, Clarification, Release, Display, Approved List
    - **Release** → Release, Display, Approved List
- Buttons are rendered as placeholders in this step (no SAP calls yet); clicking one sets the current action mode so wiring can be added later without changing layout.

**Navigation:** add an entry to `mmChildren` in `src/routes/_authenticated.tsx`, immediately after the MIGO Release item, gated by the same `approvals.inbox.mm` permission.

## Not included (confirm if you want it now)

No SAP API integration yet — you haven't specified which configured APIs each button should call or what payloads/response layouts they need. Once you share those (e.g. ZNFA_Create_API, ZNFA_Release_API and their payloads), I'll wire each button to the middleware and render header/items exactly like the other MM screens.

## Technical notes

- Route uses `createFileRoute("/_authenticated/mm/znfa-release")`; no changes to `routeTree.gen.ts` (auto-generated).
- Radio group uses the existing shadcn `RadioGroup` component; buttons use existing `Button` variants so styling matches PR/PO/MIGO screens.
- No existing files' logic changes other than adding one nav entry.
