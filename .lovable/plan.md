## Goal

On the ZNFA Release screen, after the existing Create form card, add a new full-width card titled **Scope of Work** that mirrors the reference layout. The card will use the existing application styling and only contain local UI state — no SAP calls in this step.

## Layout

```text
+--------------------------------------------------------------+
| Scope of Work                                                |
| +---------------------+ +---------------+ +----------------+ |
| | Scope Category      | | Remarks       | | Purchase Type  | |
| | [ ] Supply          | |               | | Spend Category | |
| | [ ] Installation    | |               | | Item Category  | |
| | [ ] Construction... | |             | | Purch. Group   | |
| | ...                 | |               | |                | |
| +---------------------+ +---------------+ +----------------+ |
+--------------------------------------------------------------+
```

- Full-width card rendered below the existing Create/Buyer Details card, only when Create is selected.
- Inside the card: a 3-column responsive grid.
  - Left column: Scope Category with a vertical list of checkboxes.
  - Middle column: Remarks with a 3-row multiline textarea.
  - Right column: Purchase Type section with Spend Category, Item Category, and Purchasing Group text inputs.
- On mobile, the three columns stack vertically.

## Behaviour

- Scope Category options are fixed:
  - Supply
  - Installation
  - Construction works including all supplies
  - Construction with FIM (Free issue Material)
  - Supervision
  - Commissioning
  - Service
  - ARC
- Multiple categories can be selected; toggling a checkbox adds/removes the value from the local state.
- Remarks is a plain textarea limited to 3 rows.
- Purchase Type fields are plain text inputs with no F4 help for now.
- All state is local to the component; switching mode or action resets the Scope of Work form.

## Technical

- Single file change: `src/routes/_authenticated/mm.znfa-release.tsx`.
- Reuse `Card`, `Label`, `Input`, `Checkbox`, `Textarea` from `@/components/ui/*`; no new colors or CSS — semantic tokens only.
- Add local state for:
  - `scopeCategories`: string[]
  - `remarks`: string
  - `spendCategory`: string
  - `itemCategory`: string
  - `purchasingGroup`: string
- Extend `resetCreateForm()` to clear the new fields.
- No changes to existing business logic, routes, or server functions.