# Service Entry Sheet screen (ML81N / ENTRY_REL)

New MM screen placed right after ZNFA Release in the sidebar, built as a selection form matching the attached SAP reference screens and the app's existing card styling.

## Cards, in order

1. **Release**
   - Release Code (dropdown from the login-response release keys for the selected plants)
   - Release Group (single field only — no "To" field)
   - Set Release / Cancel Release checkboxes (Set Release ticked by default, mutually exclusive)
   - No arrow / F4 icons anywhere.

2. **PO Data** — from/to text inputs, no arrow icons: Purchase Order, Document Date, Document Type, Supplier, Purchasing Organization, Purchasing Group, Plant, Material/Service Group.

3. **Entry Sheet Data** — from/to text inputs, no arrow icons: Entry Sheet, External Number, Created on, Model Service Specifications, Purchase Requisition, Maintenance Plan, Freight Cost Document.

4. **Blocking Indicator** — radio group: Not Blocked (default), Blocked, All.

5. **Acceptance Indicator** — radio group: Not Accepted (default), Accepted, All.

6. **Scope of List** — single input pre-filled with `ENTRY_REL`.

Footer actions: **Execute** and **Reset**, styled like PR/PO Release. Date fields use date inputs; numeric-ish SAP fields stay text so leading zeros are preserved.

## Behaviour

- Reset clears everything back to defaults (including `ENTRY_REL` and the default radio choices).
- Execute validates that a Release Code is chosen and then, since no Service Entry Sheet SAP endpoint is configured yet, shows the app's standard "not connected yet" info message in the same dialog style used elsewhere. Wiring the real SAP call is a later step once the endpoint name/payload is available.

## Technical notes

- New route file `src/routes/_authenticated/mm.service-entry-sheet.tsx` with `createFileRoute("/_authenticated/mm/service-entry-sheet")`.
- Add one nav entry in `src/routes/_authenticated.tsx` after the ZNFA Release item, reusing screen key `approvals.inbox.mm`.
- Reuse existing primitives only: `PageHeader`, `Card`, `Label`, `Input`, `Checkbox`, `RadioGroup`, `Select`, `Button`, plus `useActiveContext` + `releaseKeysFor(plants, "po", plantCodes)` for the Release Code list.
- No changes to existing screens, server functions, styles, or database.
