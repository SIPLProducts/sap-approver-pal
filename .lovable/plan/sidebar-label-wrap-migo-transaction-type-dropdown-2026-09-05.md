# Sidebar label wrap + MIGO Transaction Type dropdown

## 1. Sidebar — two-line "Price Master Update Approvals"

In `src/routes/_authenticated.tsx`, change only the IWM child label for `/imw/price-master-approvals` so it renders on two lines for better readability.

- Replace the single `label: "Price Master Update Approvals"` with a small inline fragment / JSX label: line 1 "Price Master Update", line 2 "Approvals".
- Keep the same route, icon, permission gate and all other sidebar items unchanged.
- Ensure text still fits the collapsed/expanded sidebar widths and does not break layout of sibling items.

## 2. MIGO screen — Transaction Type dropdown

In `src/routes/_authenticated/mm.migo-release.tsx`:

- Add a `Select` dropdown **before** the Material Document Number field.
- Label: "Transaction Type".
- Options: Release, Display, Cancel.
- Default selection: Release.
- Store selection in local state (`transactionType: "release" | "display" | "cancel"`).

On Execute (`execute()`):
- Continue sending `mblnr` and `mjahr` exactly as today.
- Additionally send one of:
  - `RELEASE: "X"` when Release is selected
  - `DISPLAY: "X"` when Display is selected
  - `CANCEL: "X"` when Cancel is selected
- The other two new flags are sent as empty strings.

In `src/lib/mm/migo-release.functions.ts`:
- Extend the `fetchMigo` input validator to accept `transaction_type: z.enum(["release", "display", "cancel"])`.
- Build the SAP inputs object with the existing `mblnr`/`mjahr` plus the chosen uppercase flag set to `"X"` and the others as `""`.
- Do not change response parsing, error handling, logging, `checkMigo`, `saveMigo`, or `postMigo`.

## What stays the same

- All existing MIGO fields, buttons, table columns, editable cells, Post/Check flows.
- Sidebar structure, permissions, routes and other module labels.
- SAP API config name (`MIGO_Fetch_API`) and response shape expectations.

## Verification

- Typecheck (`bunx tsgo --noEmit -p tsconfig.json`).
- Sidebar shows "Price Master Update" / "Approvals" stacked for the approvals item only.
- MIGO Execute sends the correct flag for each Transaction Type while keeping `mblnr`/`mjahr` unchanged.
