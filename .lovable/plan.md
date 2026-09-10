# Remove "Z" from ZTER Rating Header Title

## Goal
Change the main page header on the ZTER Rating screen from "ZTER Rating" to "TER Rating", without affecting any other functionality, API, validation, or UI behavior.

## What changes

1. **src/routes/_authenticated/mm.gate-process.tsx** (line ~466)
   - `PageHeader title="ZTER Rating"` → `PageHeader title="TER Rating"`

## What does NOT change

- Route path `/mm/gate-process` and route ID.
- Screen key `mm.gate_process` and permission label "ZTER Rating" in `src/lib/admin/screen-keys.ts`.
- Sidebar navigation label "ZTER Rating" in `src/routes/_authenticated.tsx`.
- Dialog titles, DataTable title, empty message, and `defaultTitle` that still reference "ZTER Rating".
- SAP API names, payload shapes, business logic, filters, pagination, and validations.

## Verification

- Run `bunx tsgo --noEmit -p tsconfig.json`.
- Confirm the main header reads "TER Rating" in the preview.
