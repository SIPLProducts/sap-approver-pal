# Financial Year Base Rate Screen

Add **Financial Year Base Rate** to IWM Approvals immediately after **Average Selling Rate**.

## Scope
- Create a dedicated authenticated screen matching the existing IWM selection-screen design.
- Include the shared IWM Plant F4 selector and an Execute button.
- Add a distinct permission entry for this screen and include it in the existing IWM-wide role fallback.
- Leave current screens, SAP flows, and behavior unchanged.
- No SAP API name or request contract has been supplied, so Execute will validate Plant selection and remain unconnected until those details are provided.

## Technical details
- Reuse `PlantMultiSelect` with `source="iwm-plant"` and the current active-plant behavior.
- Add a new TanStack authenticated route with unique page metadata.
- Insert only the new IWM navigation item, permission mapping, and corresponding test coverage.
