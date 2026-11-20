# Financial Year Base Rate — columns and buttons by New Record

Only the Financial Year Base Rate screen changes. Execute, the SAP call, the Customer pickers and Reset stay as they are.

## Behaviour (decided at Execute time, like Transportation (90%) Exception Billing)
- **New Record ticked, then Execute:**
  - The table shows Plant, Customer, Customer Name, Material and Financial Base Rate.
  - Updated Person, Updated Date, Approver and Status are hidden.
  - **Save** is shown at the top-right of the table.
- **New Record not ticked, then Execute:**
  - The table shows Plant, Customer, Customer Name, Material, Financial Base Rate, Updated Person, Updated Date, Approver and Status.
  - **Change** (green) and **Delete** (red) are shown at the top-right of the table, in place of Save.
- **Web User column:** removed in both modes.
- Ticking or unticking New Record without clicking Execute again doesn't change the table. Reset clears the remembered mode.

## Buttons
- They look and sit exactly like Transportation's Save, Change and Delete. They stay greyed out until at least one row is ticked.
- No SAP API has been given for them, so for now Save, Change and Delete each show a short "will be connected once the SAP API details are provided" note. Nothing is sent to SAP.

## Technical details
- Add `executedCheck` state, set in `execute()` and cleared in `reset()`.
- Build `visibleColumns` with `useMemo`, filtering out UPDATED_BY, UPDATED_ON, APPROV_BY and STATUS when `executedCheck === "X"`. Pass it to the table.
- Remove the WEB_USER column and the `WEB_USER_KEYS` constant.
- `headerExtras` shows Save when the check flag is "X", and Change/Delete otherwise.
