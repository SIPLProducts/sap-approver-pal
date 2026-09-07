# ZGP Report screen (MM Approvals)

Add a new **ZGP Report** screen to the MM Approvals menu, directly below Gate Pass. Layout and fields mirror the SAP "RGP and NRGP Status Report" selection screen. The screen is presentation-only for now — no SAP call is wired until the service details are shared.

## Menu

- New sidebar entry "ZGP Report" under MM Approvals, placed right after Gate Pass, using the same visibility rule as the other MM screens.
- Registered as a screen in the permissions list so it appears in Custom Roles alongside the other MM approval screens.

## Screen layout

**Header** — standard page header used across MM screens: eyebrow "MM Approvals", title "ZGP Report", short subtitle.

**Selection card** — a clean two-column responsive grid of From/To pairs, one row per field, matching SAP one-to-one:

```text
Field              From            To
RGP/NRGP           [ RGP ▾ ]       [        ]
Gate Pass Number   [        ]      [        ]
Plant              [        ]      [        ]
Material           [        ]      [        ]
Date               [ date ]        [ date ]
Vendor             [        ]      [        ]
```

- RGP/NRGP "From" is a small dropdown offering the two SAP entries — RGP (Returnable gate pass) and NRGP (Non returnable gate pass) — plus a blank option; the "To" stays a plain input, as in SAP.
- Date From/To use the app's date picker, displaying DD-MM-YYYY to match the other MM screens.
- Labels are aligned in a left column on wide screens and stack above the inputs on mobile; every row uses the same height and spacing.
- Card footer actions: **Execute** (primary) and **Reset** (clears all filters).

**Results card** — the same table component and styling used by Service Entry Sheet / ZTER Rating: sticky header, horizontal scroll on narrow screens, page-size control and search. Until the service is wired, Execute shows the results card in an empty state reading that the ZGP report service is not connected yet, so the screen reads as intentional rather than broken.

## Not changed

No changes to Gate Pass or any other MM screen, no new APIs, no changes to existing validations, filters, pagination, or SAP configuration.

## Technical notes

- New route file `src/routes/_authenticated/mm.zgp-report.tsx` with `createFileRoute("/_authenticated/mm/zgp-report")`, using `PageHeader`, `Card`, `Input`, `Label`, `Button`, the shadcn date picker, and `CloudscapeApprovalTable`.
- `src/routes/_authenticated.tsx`: add `{ to: "/mm/zgp-report", label: "ZGP Report", icon: FileText, screen: "approvals.inbox.mm" }` after the Gate Pass entry.
- `src/lib/admin/screen-keys.ts`: add `{ key: "mm.zgp_report", label: "ZGP Report", activity: "MM.ZGP_REPORT" }` after `mm.gate_pass`.
- Filter state kept local in the component; columns will come from `buildDynamicColumns` once real rows arrive.
- Verification: typecheck plus a preview pass on the new route and on Gate Pass to confirm nothing shifted.
