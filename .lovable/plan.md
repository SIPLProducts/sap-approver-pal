# MIGO Cancel/Display behaviour

## 1. Cancel transaction type — red Cancel button

In `src/routes/_authenticated/mm.migo-release.tsx`, where the results action button is currently rendered:

- When `transactionType === "cancel"`, render a **Cancel** button instead of **Post**.
- Use the existing destructive/red button variant (`variant="destructive"`).
- Keep the same click handler and disabled rules as the Post button (`onPost`, `selected.size === 0 || postMutation.isPending`).
- No other behaviour changes.

## 2. Display transaction type — read-only items + no action button

In the same file:

- When `transactionType === "display"`:
  - Do **not** render the action button (neither Post nor Cancel).
  - Make every editable cell in the items table read-only:
    - Checkbox columns (`WARRANTY`, `OK`) → `disabled`.
    - Editable text column (`STGE_LOC`) → `disabled`.
    - Stock type dropdown (`STCK_TYPE`) → `disabled`.
  - Hide row-selection checkboxes by passing `showSelect={transactionType !== "display"}` to `CloudscapeApprovalTable`.
- When `transactionType === "release"`, keep the current editable cells and Post button exactly as today.

## What stays the same

- The Transaction Type dropdown, Execute payload, `mblnr`/`mjahr` handling, `RELEASE`/`DISPLAY`/`CANCEL` flag logic in `src/lib/mm/migo-release.functions.ts`.
- The Post/Cancel action still calls the existing `postMigo` server function with the same selected rows and edits.
- `checkMigo`, `saveMigo`, response parsing, error handling and table columns are untouched.

## Verification

- Typecheck (`bunx tsgo --noEmit -p tsconfig.json`).
- With Transaction Type = **Release**: Post button visible, table editable.
- With Transaction Type = **Display**: no action button, all item inputs disabled, no row checkboxes.
- With Transaction Type = **Cancel**: red Cancel button visible in place of Post, still requires a selected row.
