# Transportation (90%) Exception Billing — SAP Results and F4 Fields

## Scope

Update only the Transportation (90%) Exception Billing screen and its SAP API configuration lookup. Preserve its existing Plant F4 control, layout, and other screens.

## Changes

- On Execute, call the active `90%_Get_API` configuration with `get_data.plant` populated from the selected plant value(s), in the requested `{ plant: [...] }` structure.
- Show returned records in the existing approval-table style. Build columns from response fields, omit `MANDT`, render `CHK_VALUE` as a checkbox checked when its value is `X`, and render `REMARK` as an editable input matching PR Release.
- Restore editable Customer and Customer Name F4 fields using the existing `90%_CUST_API` and `90%_CUSTNAME_API` lookups and payloads, without changing Plant selection behavior.
- Keep remarks and checkbox edits in the displayed results only; no write-back API or save behavior was specified.
- Keep Execute loading/error/empty states and Reset behavior consistent with the current screen.

## Technical details

- Add the `90%_Get_API` active-config lookup following the existing SAP config lookup pattern.
- Use the authenticated `runSapApi` server function for Execute; extract response rows using the app's existing SAP response patterns.
- Maintain row-specific local state for editable `REMARK` and `CHK_VALUE` cells; exclude `MANDT` from generated columns.
- Reuse `CustomerSelect` with its configured IDs and field/payload overrides; leave `PlantMultiSelect` unchanged.

## Verification

- Typecheck the updated app.
- Verify the screen sends the selected plant(s), renders response fields without `MANDT`, initializes checkboxes from `CHK_VALUE`, allows Remarks editing, and displays both Customer F4 dropdowns.
