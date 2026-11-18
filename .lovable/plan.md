# Add Distance Master Screen

## Scope
Add one new IWM Approvals screen named **Distance Master Screen**, directly after **Transportation (90%) Exception Billing Approvals** in the sidebar. Do not alter existing screens or their approval, SAP, permission, or data behavior beyond registering the new screen.

## Screen behavior
- Add a dedicated authenticated route with a page title and short description consistent with the existing IWM screens.
- Add a Plant field using the same IWM Plant F4 selector as Price Master Update.
- Add an Execute button using the existing IWM Execute button styling. Validate that at least one plant is selected; for now, show an informational notice that SAP execution is not connected.
- Keep the screen’s layout and visual styling consistent with the neighboring IWM selection screens.

## Navigation and access
- Add a dedicated screen-permission key and SAP activity mapping for Distance Master Screen.
- Add its navigation item immediately after Transportation (90%) Exception Billing Approvals.
- Include it in the IWM screen group so the existing IWM inbox access behavior applies consistently.

## Technical details
- Create a dedicated authenticated TanStack route for the new screen, with unique page metadata.
- Reuse the shared `PlantMultiSelect` with the existing `iwm-plant` source and active-plant selection behavior.
- Update only the screen-permission registry, IWM sidebar list, and focused permission tests alongside the new route.
- No SAP endpoint, request, database, or migration changes.
