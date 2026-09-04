# Price Master Update — Refresh results table on mode change

## Goal
When the user switches the **Display / Update** radio button on the Price Master Update screen, clear the results table so the user must click **Execute** again to fetch fresh data.

## Change
In `src/routes/_authenticated/imw.price-master.tsx`, update the `RadioGroup` `onValueChange` handler that sets the mode:
- When the mode changes (to either `"display"` or `"update"`), also reset the result state:
  - `setRows([])`
  - `setSelected(new Set())`
  - `setEdits({})`
- Keep the existing credential-dialog behavior for **Update** mode exactly as it is today (open dialog immediately when Update is selected).
- Do not trigger any API call on mode change; the user must still press **Execute**.

## Files touched
- `src/routes/_authenticated/imw.price-master.tsx` only.

## What stays the same
- All existing code, logic, and functionality for fetching, updating, selection, inline edits, credentials, and SAP response dialogs.
- No changes to server functions, routes, screen keys, sidebar labels, or role permissions.
