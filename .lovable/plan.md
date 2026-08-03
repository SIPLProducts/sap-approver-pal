# ZNFA Release — show the same form for Change as for Create

Right now the detail form (Type of NFA, RFQ Number, NFA Title, Buyer Details, Scope of Work, PR/RFQ Details, Final Recommendation, Award & Attachments) only renders when the action is **Create**. Clicking **Change** shows nothing below the selection screen.

## Change

In Creation mode, render the exact same cards and layout when the action is either **Create** or **Change** — same fields, same order, same styling, same state, same reset behaviour.

Nothing else changes: the buttons, mode switching, toasts, and the "SAP service not connected yet" notice all stay as they are. No new API calls or business logic.

## Technical notes

- Single file: `src/routes/_authenticated/mm.znfa-release.tsx`.
- The gate `showCreate = mode === "creation" && action === "Create"` becomes a check that also accepts `"Change"` (renamed to something neutral like `showDetailForm`), so the existing JSX block is reused unchanged.
