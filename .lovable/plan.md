## Requested changes

- Remove the Customer and Customer Name selectors from the Transportation (90%) Exception Billing filter card while keeping their existing row-level F4 selectors and API integrations intact.
- Add a row-selection checkbox at the beginning of each results row, using the existing approval-table checkbox design and selection behavior.
- Add a Save button at the top-left of the results table. Per the clarification, it is display-only: it will not call SAP or persist edits.
- Keep the current plant filter, Execute fetch, table columns, editable cells, and other screen behavior unchanged.

## Technical approach

- Keep the changes scoped to the Transportation screen and the shared approval-table presentation, adding an optional top-left table action area without changing other screens.
- Use the table's existing row selection support and place a display-only Save button in the new action area.
- Retain customer configuration lookups and row-level Customer and Customer Name controls; remove only the two selectors from the filter card.
- Validate with the project typecheck/build signal and check the visible controls in the preview.
