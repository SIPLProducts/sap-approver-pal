# Average Selling Rate Screen

Add a new **Average Selling Rate** screen under IWM Approvals, directly after **Price Master Update Approvals**.

## Scope
- Add a dedicated authenticated screen that follows the existing IWM page styling and layout.
- Provide a Plant selector with the same IWM F4 search behavior as the Price Master screen, plus an Execute button.
- Add the screen to IWM navigation in the requested position and register a distinct screen permission key without changing existing permission behavior.
- Leave all existing screens, SAP flows, routes, and logic unchanged.
- The SAP API name and request contract are not yet provided. The screen and controls can be added now, but Execute must not make a speculative SAP request; connect it when the API details are supplied.

## Technical details
- Reuse the existing PlantMultiSelect with `source="iwm-plant"`, active-plant context, and current IWM components/styles.
- Add a new TanStack authenticated route and unique page metadata.
- Insert only the new menu item and its permission definition; do not alter existing entries or permission resolution.
