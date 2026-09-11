# ZGP Report — record selection and Cancel button (UI only)

Add row selection and a Cancel button to the ZGP Report results, mirroring the ZMC Report step. Nothing else on the screen changes.

## Behaviour

- Each result row gets a checkbox; several rows can be selected at once. The header checkbox selects or clears the rows on the current page.
- A **Cancel** button sits at the top right of the results card, beside the Search box.
- The button is disabled until at least one row is selected, and shows how many rows are selected.
- Any row can be selected, including ones already marked cancelled.
- Selection clears on Reset and whenever a new Execute brings fresh records.
- No service is called yet: this step is the button and selection only. When you send the cancel service details and payload, clicking Cancel will send the selected records and show the exact SAP message.

## Not changed

Filters, date pickers, Execute, Reset, column building, pagination, page size, search, permissions, the ZGP fetch service, other MM screens, and all existing APIs stay exactly as they are.

## Technical notes

- `src/routes/_authenticated/mm.zgp-report.tsx`: add `selected: Set<string>` state, pass `showSelect`, `selectedKeys`, `onSelectionChange` (matching the existing prop names in `src/components/aws/cloudscape-approval-table.tsx`) and a header `actions` slot containing the Cancel button; clear the set in `reset()` and at the start of `execute()`.
- The table component already supports selection and the header actions slot from the ZMC work — additive use only, other screens keep their current appearance.
- Verification: `bunx tsgo --noEmit -p tsconfig.json`.
