# ZNFA Release — Display action: Main NFA Number step

When the user picks **Display**, show an intermediate card (styled like the existing Release Code card) before any detail content. After entering a Main NFA Number and clicking Next, render the same full detail form that Create/Change shows.

## Card contents

- Card heading: `DISPLAY`, same chrome as the existing selection/release cards.
- **Main NFA Number** — text input, required.
- **Next** button — disabled until a value is entered.

## Behaviour

- On Next: mark the display step as confirmed and reveal the same cards Create/Change render (Type of NFA, RFQ Number, NFA Title, Buyer Details, Scope of Work, PR/RFQ Details, Final Recommendation, Award & Attachments) with the existing layout unchanged.
- Fields stay editable exactly as today; no read-only pass and no SAP fetch (the ZNFA APIs are still not configured, so the existing "not connected yet" notice stays).
- Switching mode or picking another action clears the Main NFA Number and the confirmed flag, via the existing reset logic.
- Release / Approved List, Create and Change behaviour stay exactly as they are.

## Technical notes

- Single file: `src/routes/_authenticated/mm.znfa-release.tsx`.
- New state `mainNfaNumber` and `displayConfirmed`, both cleared in `resetCreateForm()`.
- `showDisplayStep = action === "Display"`; the detail-form gate becomes `showCreate || (showDisplayStep && displayConfirmed)`.
- Reuse `Card` / `Label` / `Input` / `Button`; no new components, no backend or business-logic changes.
