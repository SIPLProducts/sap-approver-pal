# Transportation Exception Billing — Plant F4 field

## User-facing change
- Comment out the Customer and Customer Name fields on the Transportation (90%) Exception Billing screen.
- Add a Plant field using the same `PlantMultiSelect` control and active-plant restriction used by Price Master Update, including its searchable F4 dropdown, loading/error states, and multi-selection behavior.
- Reset clears the selected plants. Preserve the existing Execute action, results shell, customer state/config logic, API behavior, permissions, and surrounding design.

## Technical details
- Update only `src/routes/_authenticated/imw.transportation-exception-billing.tsx`: import `PlantMultiSelect`, add local plant selection state, render the Plant control in the selection row, keep the two existing customer field blocks as JSX comments, and clear plants in Reset.
- Do not change SAP APIs, payloads, execution behavior, or other screens.

## Verification
- Confirm the Plant F4 control appears and allows searching/selecting plants, the hidden customer fields no longer render, and Reset clears the plant selection.
- Confirm the screen still renders its existing empty results shell after Execute and check the preview build result.
