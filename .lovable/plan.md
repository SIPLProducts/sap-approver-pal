# Remove "Z" from ZTER Rating Sidebar Label

## Goal
Change the sidebar menu label for the ZTER Rating screen from "ZTER Rating" to "TER Rating", matching the updated page header, without affecting any other functionality, API, validation, or UI behavior.

## What changes

1. **src/routes/_authenticated.tsx** (line ~165)
   - `{ to: "/mm/gate-process", label: "ZTER Rating", ... }` → `{ to: "/mm/gate-process", label: "TER Rating", ... }`

## What does NOT change

- Route path `/mm/gate-process` and route ID.
- Screen key `mm.gate_process` and permission label "ZTER Rating" in `src/lib/admin/screen-keys.ts`.
- Page header title "TER Rating" in `src/routes/_authenticated/mm.gate-process.tsx`.
- Dialog titles, DataTable title, empty message, and `defaultTitle` that still reference "ZTER Rating".
- SAP API names, payload shapes, business logic, filters, pagination, and validations.

## Verification

- Run `bunx tsgo --noEmit -p tsconfig.json`.
- Confirm the MM Approvals sidebar shows "TER Rating" in the preview.
