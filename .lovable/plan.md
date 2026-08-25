# Show all MM & SD screens in Custom Roles → Screen Permissions

Today the Screen Permissions picker in the Add/Edit Role dialog lists only four Approvals entries (MM Approvals Inbox, SD Approvals Inbox, Approval History, Approval Detail), because that list is generated from the shared screen catalog. The individual MM and SD screens that exist in the sidebar are not in that catalog, so they can't be seen or selected.

## What changes

1. **Add every MM and SD screen to the shared screen catalog**, grouped under two new modules:
   - **MM Approvals**: MM Dashboard, PR Release, PO Release, Material Reservation, ZNFA Rating, Gate Pass, MIGO Release, ZNFA Release, Service Entry Sheet.
   - **SD Approvals**: SD Dashboard, Price Approvals, Contract Approvals, Service Cert & SO, Sales Order Approvals, BMW Status Report.

2. **Group the picker by module** in the role dialog so the longer list stays readable: a small heading per module (Approvals, MM Approvals, SD Approvals, Admin, SAP, Reports, Settings) with its screens under it, keeping the existing selectable tiles, Select All / Deselect All, and the "x of y assigned" counter.

## What stays the same

- Access control is untouched: the sidebar and route/server checks keep gating MM screens on the existing MM Approvals Inbox permission and SD screens on the SD Approvals Inbox permission. The new entries are additional selectable screens in the catalog, not new gates.
- Login landing resolution, SAP activity mapping for existing screens, saving/editing roles, and the Role Permissions tab behaviour all keep working as-is (the Role Permissions tab renders from the same catalog, so it simply shows the new screens too).

## Technical notes

- `src/lib/admin/screen-keys.ts`: add two `SCREEN_GROUPS` entries with keys such as `mm.dashboard`, `mm.pr_release`, … and `sd.dashboard`, `sd.price`, … each with an UPPER_SNAKE SAP activity code (`MM.DASHBOARD`, `SD.PRICE`, …). `ALL_SCREENS` and both activity/key maps derive from this array, so no other mapping code changes.
- `src/routes/_authenticated/admin.users.tsx`: the dialog currently maps the flattened `allScreens`; render `SCREEN_GROUPS` instead (module label + its screens) while reusing the same toggle handler and `allScreens` for the counter and Select All.
- No changes to `src/routes/_authenticated.tsx`, `src/lib/landing-target.ts`, `use-permissions.ts`, or `assert-screen.ts`.
