# Add Execute + Reset buttons to 5 IWM screens

Screens: Average Selling Rate, Financial Year Base Rate, Transportation (90%) Exception Billing Approvals, Distance Master, Vehicle Master.

## What changes
- Execute and Reset sit together at the right end of the Plant row, exactly like Transportation (90%) Exception Billing: Execute (small, red, refresh icon) then Reset (small, plain/ghost style), 8px gap.
- Reset clears the selected Plant(s) and returns the screen to its default state, like the existing Reset:
  - Average Selling Rate, Financial Year Base Rate, Distance Master, Vehicle Master: clear plants.
  - Transportation Approvals: clear plants, status back to Pending, clear results table, row selections, hidden Approve/Reject buttons, and any pending request state.
- Reset is disabled while a request is running (Transportation Approvals only, same as reference).

## Not changed
Execute behavior, SAP calls, payloads, permissions, status design, table, Approve/Reject logic, menus.

## Technical details
- Each file: add a `reset()` function; change the button wrapper to `flex justify-self-end gap-2`; grid gains a trailing `1fr` column where needed so buttons align right (`lg:grid-cols-[220px_1fr]` already fits; Approvals becomes `[220px_1fr]`).
- Transportation Approvals reset: `setPlants([]); setStatus("pending"); setRows([]); setSelectedKeys(new Set()); setExecuted(false); setExecutedStatus(null); fetchMutation.reset();`
