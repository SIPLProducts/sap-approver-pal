# Transportation (90%) Exception Billing Approvals Screen

Add a new **Transportation (90%) Exception Billing Approvals** screen directly after **Transportation (90%) Exception Billing** in IWM Approvals.

## Scope
- Create a new authenticated screen that follows existing IWM selection-screen styling.
- Include the shared IWM Plant F4 selector, status radio options **Pending**, **Completed**, and **Rejected**, and an **Execute** button.
- This is UI-only: do not connect Execute to SAP or invent a request payload or result table.
- Add a dedicated screen permission and include it in the existing IWM-wide permission fallback.
- Leave existing screens and their logic unchanged.

## Technical details
- Reuse `PlantMultiSelect` with `source="iwm-plant"` and the existing active-plant behavior.
- Add a new TanStack authenticated route with unique page metadata.
- Add only the new IWM menu entry, permission mapping, and permission test coverage.
