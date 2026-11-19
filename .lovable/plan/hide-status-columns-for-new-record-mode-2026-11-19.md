# Hide status columns for New Record mode

## Scope
In the Transportation (90%) Exception Billing screen, hide **Approved By**, **Updated By**, and **Status** columns only when the existing **New Record** option is selected. Preserve all other table behavior and functionality.

## Implementation
- Use the existing New Record selection state for conditional column visibility.
- Keep the three column definitions and their current rendering unchanged in normal mode; omit only those columns from the displayed table in New Record mode.
- Do not change SAP requests, row data, selection, save/change actions, permissions, or other screens.

## Verification
- Add or update a focused test if the existing table-column visibility is covered by a suitable test.
- Confirm the preview build succeeds and verify that normal mode shows all columns while New Record mode hides only the requested three.
