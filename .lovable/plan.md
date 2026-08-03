## Goal

On the ZNFA Release screen, clicking **Create** reveals a two-panel form matching the reference layout, built with the existing app CSS (Card, Label, Input, Select, Button). No SAP calls in this step — UI only.

## Layout

```text
+-------------------------------------+  +-----------------------------+
| Type of NFA        [ select     v ] |  | Buyer Details               |
|                                     |  |  Buyer Id  [ readonly ]     |
| RFQ Number  [____][F4]  [Get Details]  |  Name      [ readonly ]     |
|                                     |  |  E-Mail    [ readonly ]     |
| NFA Title   [_____________________] |  |  Location  [ readonly ]     |
+-------------------------------------+  +-----------------------------+
```

- Left column (2/3 width on desktop, stacked on mobile): three grouped cards/sections — Type of NFA, RFQ block, NFA Title.
- Right column (1/3): "Buyer Details" card with 4 label/value rows, read-only inputs (muted styling), filled later from the Get Details response.
- Existing selection screen (Mode radios + action buttons) stays on top, unchanged. The form renders only when the active action is `Create`.

## Behaviour in this step

- `Type of NFA`: `Select` component, rendered with a "Loading…"/empty placeholder; wired to an API in a follow-up once the SAP API config name is confirmed (no config in Admin -> SAP API currently matches an NFA-type F4).
- `RFQ Number`: text input plus a small F4 icon button; button shows an "F4 help coming soon" toast for now.
- `Get Details`: button (existing amber/primary styling) that shows an info toast; it will later populate Buyer Details.
- `NFA Title`: free-text input.
- Local component state only; switching mode or action resets the form.

## Technical

- Single file change: `src/routes/_authenticated/mm.znfa-release.tsx`.
- Reuse `Card`, `Label`, `Input`, `Button`, `Select` from `@/components/ui/*`; no new colors or CSS — semantic tokens only.
- No changes to existing business logic, routes, or server functions.

## Follow-up needed from you

- Name of the SAP API config for the **Type of NFA** F4 values.
- Name of the API for **RFQ Number** F4 and **Get Details** (and its response fields for Buyer Id / Name / E-Mail / Location).
