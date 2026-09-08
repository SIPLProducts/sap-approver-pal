# ZMC Report screen (MM Approvals)

Add a new **ZMC Report** screen to MM Approvals, directly below Material Reservation. Layout mirrors the SAP "Material Reservation Status" selection screen. Presentation-only for now — no SAP call is wired until the service details are shared.

## Menu

- New sidebar entry "ZMC Report" right after Material Reservation, using the same visibility rule as the other MM screens.
- Registered in the permissions list so it appears in Custom Roles with the other MM screens.

## Screen layout

**Header** — eyebrow "MM Approvals", title "ZMC Report", short subtitle.

**Selection card** — From/To pairs in a balanced two-column responsive grid, matching SAP one-to-one:

```text
Field             From          To
Plant             [      ]      [      ]
Date              [ date ]      [ date ]
Document Number   [      ]      [      ]
Movement Type     [      ]      [      ]
```

- Date From/To use the app's date picker, displaying DD-MM-YYYY like the other MM screens.
- Labels above grouped From/To controls with a "to" separator on wide screens; groups stack cleanly on phones.
- Footer actions: **Execute** (primary) and **Reset** (clears all filters).

**Results card** — same table component and styling as ZGP Report / ZTER Rating: sticky header, horizontal scroll on narrow screens, page-size control. Until the service is wired, Execute reveals the results card in an empty state stating the ZMC report service is not connected yet.

## Not changed

No changes to Material Reservation or any other MM screen, no new APIs, no changes to existing validations, filters, pagination, permissions, or SAP configuration.

## Technical notes

- New route `src/routes/_authenticated/mm.zmc-report.tsx` with `createFileRoute("/_authenticated/mm/zmc-report")`, reusing the ZGP Report presentation patterns (`PageHeader`, `Card`, `Input`, `Label`, `Button`, date picker popover, `CloudscapeApprovalTable`) plus its own route `head()` metadata.
- `src/routes/_authenticated.tsx`: add `{ to: "/mm/zmc-report", label: "ZMC Report", icon: FileText, screen: "approvals.inbox.mm" }` after the Material Reservation entry.
- `src/lib/admin/screen-keys.ts`: add `{ key: "mm.zmc_report", label: "ZMC Report", activity: "MM.ZMC_REPORT" }` after `mm.material_reservation`.
- Filter state is local to the component; result columns cover Plant, Date, Document Number, Movement Type and will switch to dynamic columns once real rows arrive.
- Verification: typecheck plus a desktop/mobile preview pass on the new route and on Material Reservation to confirm nothing shifted.
