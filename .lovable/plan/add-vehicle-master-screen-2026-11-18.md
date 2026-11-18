# Add Vehicle Master Screen

## Scope
Add one IWM Approvals screen named **Vehicle Master**, immediately after the existing **Distance Master Screen**. Keep existing screens and their behavior unchanged.

## Screen behavior
- Add a dedicated authenticated page matching the neighboring IWM selection screens.
- Use the shared Plant F4 selector with the existing `iwm-plant` source and active-plant selection behavior.
- Add an Execute button with the existing IWM styling. Require a selected plant; keep execution UI-only and show an informational notice because no SAP API details were provided.

## Navigation and access
- Add a dedicated permission key and activity mapping for Vehicle Master.
- Place its sidebar item immediately after Distance Master Screen.
- Include it in the IWM screen list so current IWM inbox permission behavior applies.

## Technical details
- Add a dedicated authenticated TanStack route with unique page metadata.
- Update only the new route, permission registry, IWM menu, and focused permission test.
- No SAP calls, database changes, or changes to existing screen logic.
